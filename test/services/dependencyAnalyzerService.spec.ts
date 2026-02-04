/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites require many test cases */
/* eslint-disable @typescript-eslint/naming-convention -- Test data uses npm package names and destructured imports */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- Required for mocking */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDaysAgoIso = (days: number): string => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const ageMs = days * msPerDay;
  return new Date(Date.now() - ageMs).toISOString();
};

vi.mock("@nhcarrigan/logger", () => {
  return {

    Logger: class MockLogger {
      public error = vi.fn();
      public log = vi.fn();
    },
  };
});

interface MockNpmService {
  getPackageChangelog: ReturnType<typeof vi.fn>;
  getPackageInfo:      ReturnType<typeof vi.fn>;
}

const createMockNpmService = (): MockNpmService => {
  return {
    getPackageChangelog: vi.fn(),
    getPackageInfo:      vi.fn(),
  };
};

describe("dependencyAnalyzerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return empty array when no dependencies", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({});
    expect(result).toStrictEqual([]);
  });

  it("should find updates for dependencies", async() => {
    expect.assertions(2);
    const mockNpmService = createMockNpmService();
    // Include time field with a date >10 days ago for the mature version check
    const oldDate = getDaysAgoIso(15);
    mockNpmService.getPackageInfo.mockResolvedValue({
      "dist-tags": { latest: "2.0.0" },
      "name":      "test-package",
      "time":      { "2.0.0": oldDate },
      "versions":  { "2.0.0": { version: "2.0.0" } },
    });
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "test-package": "1.0.0",
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toStrictEqual({
      currentVersion: "1.0.0",
      latestVersion:  "2.0.0",
      packageName:    "test-package",
      type:           "dependencies",
    });
  });

  it("should skip file: protocol dependencies", async() => {
    expect.assertions(2);
    const mockNpmService = createMockNpmService();
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "local-package": "file:../local-package",
      },
    });
    expect(result).toStrictEqual([]);
    expect(mockNpmService.getPackageInfo).not.toHaveBeenCalled();
  });

  it("should skip git: protocol dependencies", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "git-package": "git:github.com/user/repo",
      },
    });
    expect(result).toStrictEqual([]);
  });

  it("should skip http: protocol dependencies", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "http-package": "http://example.com/package.tgz",
      },
    });
    expect(result).toStrictEqual([]);
  });

  it("should skip https: protocol dependencies", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "https-package": "https://example.com/package.tgz",
      },
    });
    expect(result).toStrictEqual([]);
  });

  it("should skip github: shorthand dependencies", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "github-package": "github:user/repo",
      },
    });
    expect(result).toStrictEqual([]);
  });

  it("should skip * version dependencies", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "star-package": "*",
      },
    });
    expect(result).toStrictEqual([]);
  });

  it("should skip latest version dependencies", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "latest-package": "latest",
      },
    });
    expect(result).toStrictEqual([]);
  });

  it("should not include packages that are already up-to-date", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    const oldDate = getDaysAgoIso(15);
    mockNpmService.getPackageInfo.mockResolvedValue({
      "dist-tags": { latest: "1.0.0" },
      "name":      "test-package",
      "time":      { "1.0.0": oldDate },
      "versions":  { "1.0.0": { version: "1.0.0" } },
    });
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "test-package": "1.0.0",
      },
    });
    expect(result).toStrictEqual([]);
  });

  it("should handle packages not found on npm", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    mockNpmService.getPackageInfo.mockResolvedValue(null);
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "non-existent": "1.0.0",
      },
    });
    expect(result).toStrictEqual([]);
  });

  it("should handle version prefixes like ^", async() => {
    expect.assertions(2);
    const mockNpmService = createMockNpmService();
    const oldDate = getDaysAgoIso(15);
    mockNpmService.getPackageInfo.mockResolvedValue({
      "dist-tags": { latest: "2.0.0" },
      "name":      "test-package",
      "time":      { "2.0.0": oldDate },
      "versions":  { "2.0.0": { version: "2.0.0" } },
    });
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "test-package": "^1.0.0",
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.currentVersion).toBe("^1.0.0");
  });

  it("should handle npm errors gracefully", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    mockNpmService.getPackageInfo.mockRejectedValue(new Error("Network error"));
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "test-package": "1.0.0",
      },
    });
    expect(result).toStrictEqual([]);
  });

  it("should handle semver comparison errors", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    const oldDate = getDaysAgoIso(15);
    mockNpmService.getPackageInfo.mockResolvedValue({
      "dist-tags": { latest: "invalid-version" },
      "name":      "test-package",
      "time":      { "invalid-version": oldDate },
      "versions":  { "invalid-version": { version: "invalid-version" } },
    });
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "test-package": "also-invalid",
      },
    });
    expect(result).toStrictEqual([]);
  });

  it("should return null when no mature version exists", async() => {
    expect.assertions(1);
    const mockNpmService = createMockNpmService();
    // Use a very recent date (2 days ago) so getLatestMatureVersion returns null
    const recentDate = getDaysAgoIso(2);
    mockNpmService.getPackageInfo.mockResolvedValue({
      "dist-tags": { latest: "2.0.0" },
      "name":      "test-package",
      "time":      { "2.0.0": recentDate },
      "versions":  { "2.0.0": { version: "2.0.0" } },
    });
    const { DependencyAnalyzerService }
      = await import("../../src/services/dependencyAnalyzerService.js");
    const analyzerService = new DependencyAnalyzerService(
      mockNpmService as Parameters<typeof DependencyAnalyzerService>[0],
    );
    const result = await analyzerService.analyzePackageJson({
      dependencies: {
        "test-package": "1.0.0",
      },
    });
    expect(result).toStrictEqual([]);
  });
});
