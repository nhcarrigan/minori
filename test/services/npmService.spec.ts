/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites require many test cases */
/* eslint-disable @typescript-eslint/naming-convention -- Test data uses npm package names */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- Required for mocking */
/* eslint-disable @typescript-eslint/consistent-type-imports -- Dynamic imports */
/* eslint-disable vitest/require-to-throw-message -- Generic throw assertion */
/* eslint-disable stylistic/max-len -- Test files have long URLs */
/* eslint-disable max-lines -- Test files have many test cases */
/* eslint-disable max-statements -- Test describe blocks have many statements */

import axios, { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NpmService } from "../../src/services/npmService.js";

const getDaysAgoIso = (days: number): string => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const ageMs = days * msPerDay;
  return new Date(Date.now() - ageMs).toISOString();
};

vi.mock("axios", async() => {
  const actualAxios = await vi.importActual<typeof import("axios")>("axios");
  return {

    AxiosError: actualAxios.AxiosError,
    default:    {
      create: vi.fn(() => {
        return {
          get: vi.fn(),
        };
      }),
      get: vi.fn(),
    },
    isAxiosError: actualAxios.isAxiosError,
  };
});

vi.mock("@nhcarrigan/logger", () => {
  return {

    Logger: class MockLogger {
      public error = vi.fn();
      public log = vi.fn();
    },
  };
});

const createMockPackageInfo = (
  version: string,
  repositoryUrl?: string,
): Record<string, unknown> => {
  const versionData: Record<string, unknown> = { version };
  if (repositoryUrl !== undefined) {
    versionData.repository = { url: repositoryUrl };
  }
  return {
    "dist-tags": { latest: version },
    "name":      "test-package",
    "versions":  { [version]: versionData },
  };
};

describe("npmService", () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations -- Reassigned in beforeEach
  let npmService: NpmService;
  // eslint-disable-next-line @typescript-eslint/init-declarations -- Reassigned in beforeEach
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITEA_TOKEN = "test-token";

    mockGet = vi.fn();
    vi.mocked(axios.create).mockReturnValue({
      get: mockGet,
    } as unknown as ReturnType<typeof axios.create>);

    npmService = new NpmService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return package info when found", async() => {
    expect.assertions(2);
    const mockPackageInfo = {
      "dist-tags": { latest: "2.0.0" },
      "name":      "test-package",
      "versions":  {
        "2.0.0": {
          repository: { url: "https://github.com/test/test.git" },
          version:    "2.0.0",
        },
      },
    };
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    const result = await npmService.getPackageInfo("test-package");
    expect(result).toStrictEqual(mockPackageInfo);
    expect(mockGet).toHaveBeenCalledWith("/test-package");
  });

  it("should return null when package is not found (404)", async() => {
    expect.assertions(1);
    const axiosError = new AxiosError("Not Found");
    axiosError.response = { status: 404 } as AxiosResponse;
    mockGet.mockRejectedValueOnce(axiosError);
    const result = await npmService.getPackageInfo("non-existent-package");
    expect(result).toBeNull();
  });

  it("should throw for non-404 errors", async() => {
    expect.assertions(1);
    const axiosError = new AxiosError("Server Error");
    axiosError.response = { status: 500 } as AxiosResponse;
    mockGet.mockRejectedValueOnce(axiosError);
    await expect(
      npmService.getPackageInfo("test-package"),
    ).rejects.toThrow();
  });

  it("should encode scoped package names", async() => {
    expect.assertions(1);
    const mockPackageInfo = {
      "dist-tags": { latest: "1.0.0" },
      "name":      "@scope/package",
      "versions":  {},
    };
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    await npmService.getPackageInfo("@scope/package");
    expect(mockGet).toHaveBeenCalledWith("/%40scope%2Fpackage");
  });

  it("should return fallback when package info is null", async() => {
    expect.assertions(1);
    const axiosError = new AxiosError("Not Found");
    axiosError.response = { status: 404 } as AxiosResponse;
    mockGet.mockRejectedValueOnce(axiosError);
    const result = await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "non-existent",
      toVersion:   "2.0.0",
    });
    expect(result).toBe("No changelog available for non-existent");
  });

  it("should return fallback when repository URL is undefined", async() => {
    expect.assertions(1);
    const mockPackageInfo = createMockPackageInfo("2.0.0");
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    const result = await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "test-package",
      toVersion:   "2.0.0",
    });
    expect(result).toBe("Updated from 1.0.0 to 2.0.0");
  });

  it("should return fallback when not a GitHub URL", async() => {
    expect.assertions(1);
    const mockPackageInfo = createMockPackageInfo(
      "2.0.0",
      "https://gitlab.com/test/test.git",
    );
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    const result = await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "test-package",
      toVersion:   "2.0.0",
    });
    expect(result).toBe("Updated from 1.0.0 to 2.0.0");
  });

  it("should fetch GitHub releases and format changelog", async() => {
    expect.assertions(5);
    const mockPackageInfo = createMockPackageInfo(
      "2.0.0",
      "https://github.com/owner/repo.git",
    );
    const mockReleases = [

      { body: "Release notes for 2.0.0", tag_name: "v2.0.0" },

      { body: "Release notes for 1.5.0", tag_name: "v1.5.0" },

      { body: "Release notes for 1.0.0", tag_name: "v1.0.0" },
    ];
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: mockReleases });
    const result = await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "test-package",
      toVersion:   "2.0.0",
    });
    expect(result).toContain("## Changelog");
    expect(result).toContain("### v2.0.0");
    expect(result).toContain("Release notes for 2.0.0");
    expect(result).toContain("### v1.5.0");
    expect(result).not.toContain("### v1.0.0");
  });

  it("should return fallback when no relevant releases found", async() => {
    expect.assertions(1);
    const mockPackageInfo = createMockPackageInfo(
      "2.0.0",
      "https://github.com/owner/repo.git",
    );
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [] });
    const result = await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "test-package",
      toVersion:   "2.0.0",
    });
    expect(result).toBe("Updated from 1.0.0 to 2.0.0");
  });

  it("should handle GitHub API errors gracefully", async() => {
    expect.assertions(1);
    const mockPackageInfo = createMockPackageInfo(
      "2.0.0",
      "https://github.com/owner/repo.git",
    );
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("GitHub API error"));
    const result = await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "test-package",
      toVersion:   "2.0.0",
    });
    expect(result).toBe("Updated from 1.0.0 to 2.0.0");
  });

  it("should handle releases without body", async() => {
    expect.assertions(1);
    const mockPackageInfo = createMockPackageInfo(
      "2.0.0",
      "https://github.com/owner/repo.git",
    );
    const mockReleases = [

      { tag_name: "v2.0.0" },
    ];
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: mockReleases });
    const result = await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "test-package",
      toVersion:   "2.0.0",
    });
    expect(result).toContain("No release notes available");
  });

  it("should normalise git+ prefixed URLs", async() => {
    expect.assertions(1);
    const mockPackageInfo = createMockPackageInfo(
      "2.0.0",
      "git+https://github.com/owner/repo.git",
    );
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [] });
    await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "test-package",
      toVersion:   "2.0.0",
    });
    expect(axios.get).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/releases",
      expect.any(Object),
    );
  });

  it("should normalise git:// URLs", async() => {
    expect.assertions(1);
    const mockPackageInfo = createMockPackageInfo(
      "2.0.0",
      "git://github.com/owner/repo.git",
    );
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [] });
    await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "test-package",
      toVersion:   "2.0.0",
    });
    expect(axios.get).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/releases",
      expect.any(Object),
    );
  });

  it("should normalise ssh:// URLs", async() => {
    expect.assertions(1);
    const mockPackageInfo = createMockPackageInfo(
      "2.0.0",
      "ssh://git@github.com/owner/repo.git",
    );
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [] });
    await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "test-package",
      toVersion:   "2.0.0",
    });
    expect(axios.get).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/releases",
      expect.any(Object),
    );
  });

  it("should return fallback when GitHub URL has insufficient parts", async() => {
    expect.assertions(1);
    const mockPackageInfo = createMockPackageInfo(
      "2.0.0",
      "https://github.com/owner",
    );
    mockGet.mockResolvedValueOnce({ data: mockPackageInfo });
    const result = await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "test-package",
      toVersion:   "2.0.0",
    });
    expect(result).toBe("Updated from 1.0.0 to 2.0.0");
  });

  it("should handle errors in getPackageChangelog", async() => {
    expect.assertions(1);
    mockGet.mockRejectedValueOnce(new Error("Network error"));
    const result = await npmService.getPackageChangelog({
      fromVersion: "1.0.0",
      packageName: "test-package",
      toVersion:   "2.0.0",
    });
    expect(result).toBe("Updated from 1.0.0 to 2.0.0");
  });

  it("should return latest mature version when versions are old enough", () => {
    expect.assertions(1);
    const oldDate = getDaysAgoIso(15);
    const packageInfo = {
      "dist-tags": { latest: "2.0.0" },
      "name":      "test-package",
      "time":      { "1.0.0": oldDate, "2.0.0": oldDate },
      "versions":  {
        "1.0.0": { version: "1.0.0" },
        "2.0.0": { version: "2.0.0" },
      },
    };
    const result = NpmService.getLatestMatureVersion(packageInfo);
    expect(result).toBe("2.0.0");
  });

  it("should return null when no mature versions exist", () => {
    expect.assertions(1);
    const recentDate = getDaysAgoIso(2);
    const packageInfo = {
      "dist-tags": { latest: "2.0.0" },
      "name":      "test-package",
      "time":      { "2.0.0": recentDate },
      "versions":  { "2.0.0": { version: "2.0.0" } },
    };
    const result = NpmService.getLatestMatureVersion(packageInfo);
    expect(result).toBeNull();
  });

  it("should skip versions without time data", () => {
    expect.assertions(1);
    const oldDate = getDaysAgoIso(15);
    const packageInfo = {
      "dist-tags": { latest: "2.0.0" },
      "name":      "test-package",
      "time":      { "1.0.0": oldDate },
      "versions":  {
        "1.0.0": { version: "1.0.0" },
        "2.0.0": { version: "2.0.0" },
      },
    };
    const result = NpmService.getLatestMatureVersion(packageInfo);
    expect(result).toBe("1.0.0");
  });

  it("should sort versions correctly and return the latest", () => {
    expect.assertions(1);
    const oldDate = getDaysAgoIso(15);
    const packageInfo = {
      "dist-tags": { latest: "3.0.0" },
      "name":      "test-package",
      "time":      { "1.0.0": oldDate, "2.0.0": oldDate, "3.0.0": oldDate },
      "versions":  {
        "1.0.0": { version: "1.0.0" },
        "2.0.0": { version: "2.0.0" },
        "3.0.0": { version: "3.0.0" },
      },
    };
    const result = NpmService.getLatestMatureVersion(packageInfo);
    expect(result).toBe("3.0.0");
  });

  it("should use custom minimumAgeDays parameter", () => {
    expect.assertions(1);
    const fiveDaysAgo = getDaysAgoIso(5);
    const packageInfo = {
      "dist-tags": { latest: "2.0.0" },
      "name":      "test-package",
      "time":      { "2.0.0": fiveDaysAgo },
      "versions":  { "2.0.0": { version: "2.0.0" } },
    };
    // Default is 10 days, so 5 days old should be null
    const resultDefault = NpmService.getLatestMatureVersion(packageInfo);
    expect(resultDefault).toBeNull();
  });

  it("should return mature version with custom minimumAgeDays", () => {
    expect.assertions(1);
    const fiveDaysAgo = getDaysAgoIso(5);
    const packageInfo = {
      "dist-tags": { latest: "2.0.0" },
      "name":      "test-package",
      "time":      { "2.0.0": fiveDaysAgo },
      "versions":  { "2.0.0": { version: "2.0.0" } },
    };
    // With 3 days minimum, 5 days old should be valid
    const resultCustom = NpmService.getLatestMatureVersion(packageInfo, 3);
    expect(resultCustom).toBe("2.0.0");
  });

  it("should skip prerelease versions like rc, alpha, beta", () => {
    expect.assertions(1);
    const oldDate = getDaysAgoIso(15);
    const packageInfo = {
      "dist-tags": { latest: "3.0.0-rc.1" },
      "name":      "test-package",
      "time":      {
        "2.0.0":        oldDate,
        "3.0.0-alpha":  oldDate,
        "3.0.0-beta.1": oldDate,
        "3.0.0-rc.1":   oldDate,
      },
      "versions": {
        "2.0.0":        { version: "2.0.0" },
        "3.0.0-alpha":  { version: "3.0.0-alpha" },
        "3.0.0-beta.1": { version: "3.0.0-beta.1" },
        "3.0.0-rc.1":   { version: "3.0.0-rc.1" },
      },
    };
    // Should return 2.0.0 since all 3.0.0 versions are prereleases
    const result = NpmService.getLatestMatureVersion(packageInfo);
    expect(result).toBe("2.0.0");
  });

  it("should return null when only prerelease versions exist", () => {
    expect.assertions(1);
    const oldDate = getDaysAgoIso(15);
    const packageInfo = {
      "dist-tags": { latest: "1.0.0-rc.1" },
      "name":      "test-package",
      "time":      { "1.0.0-rc.1": oldDate },
      "versions":  { "1.0.0-rc.1": { version: "1.0.0-rc.1" } },
    };
    const result = NpmService.getLatestMatureVersion(packageInfo);
    expect(result).toBeNull();
  });
});
