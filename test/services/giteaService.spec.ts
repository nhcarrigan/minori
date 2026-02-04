/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites require many test cases */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- Required for mocking */
/* eslint-disable @typescript-eslint/consistent-type-imports -- Dynamic imports */
/* eslint-disable @typescript-eslint/naming-convention -- Environment variables and Gitea API format */
/* eslint-disable max-nested-callbacks -- Vitest structure requires nested callbacks */
/* eslint-disable vitest/require-to-throw-message -- Generic throw assertion */

import axios, { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GiteaService } from "../../src/services/giteaService.js";

vi.mock("axios", async() => {
  const actualAxios = await vi.importActual<typeof import("axios")>("axios");
  return {

    AxiosError: actualAxios.AxiosError,
    default:    {
      create: vi.fn(() => {
        return {
          get:  vi.fn(),
          post: vi.fn(),
        };
      }),
    },
    isAxiosError: actualAxios.isAxiosError,
  };
});

interface MockRepository {
  archived:      boolean;
  cloneUrl:      string;
  defaultBranch: string;
  disabled:      boolean;
  fullName:      string;
  id:            number;
  mirror:        boolean;
  name:          string;
}

const createMockRepository = (
  overrides: Partial<MockRepository> & { name: string; id: number },
): Record<string, unknown> => {
  return {
    archived: overrides.archived ?? false,

    clone_url: overrides.cloneUrl ?? "url",

    default_branch: overrides.defaultBranch ?? "main",
    disabled:       overrides.disabled ?? false,

    full_name: overrides.fullName ?? `nhcarrigan/${overrides.name}`,
    id:        overrides.id,
    mirror:    overrides.mirror ?? false,
    name:      overrides.name,
  };
};

describe("giteaService", () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations -- Reassigned in beforeEach
  let giteaService: GiteaService;
  // eslint-disable-next-line @typescript-eslint/init-declarations -- Reassigned in beforeEach
  let mockGet: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/init-declarations -- Reassigned in beforeEach
  let mockPost: ReturnType<typeof vi.fn>;
  const originalEnvironment = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnvironment, GITEA_TOKEN: "test-token" };

    mockGet = vi.fn();
    mockPost = vi.fn();
    vi.mocked(axios.create).mockReturnValue({
      get:  mockGet,
      post: mockPost,
    } as unknown as ReturnType<typeof axios.create>);

    giteaService = new GiteaService();
  });

  afterEach(() => {
    process.env = originalEnvironment;
    vi.resetAllMocks();
  });

  it("should throw when GITEA_TOKEN is not set", () => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "";
    expect(() => {
      return new GiteaService();
    }).toThrow("GITEA_TOKEN environment variable is required");
  });

  it("should throw when GITEA_TOKEN is undefined", () => {
    expect.assertions(1);
    delete process.env.GITEA_TOKEN;
    expect(() => {
      return new GiteaService();
    }).toThrow("GITEA_TOKEN environment variable is required");
  });

  it("should create axios client with correct configuration", () => {
    expect.assertions(1);
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: "https://git.nhcarrigan.com/api/v1",
      headers: {

        "Authorization": "token test-token",

        "Content-Type": "application/json",
      },
    });
  });

  it("should create a pull request", async() => {
    expect.assertions(2);
    const mockPullRequest = {
      base:   { ref: "main", sha: "abc123" },
      body:   "Test body",
      head:   { ref: "feature", sha: "def456" },
      id:     1,
      number: 1,
      state:  "open",
      title:  "Test PR",
    };
    mockPost.mockResolvedValueOnce({ data: mockPullRequest });
    const result = await giteaService.createPullRequest({
      base:  "main",
      body:  "Test body",
      head:  "feature",
      owner: "test-owner",
      repo:  "test-repo",
      title: "Test PR",
    });
    expect(result).toStrictEqual(mockPullRequest);
    expect(mockPost).toHaveBeenCalledWith(
      "/repos/test-owner/test-repo/pulls",
      { base: "main", body: "Test body", head: "feature", title: "Test PR" },
    );
  });

  it("should return file content when found", async() => {
    expect.assertions(2);
    const mockFile = {
      content:  "SGVsbG8gV29ybGQ=",
      encoding: "base64",
      path:     "package.json",
      sha:      "abc123",
      type:     "file",
    };
    mockGet.mockResolvedValueOnce({ data: mockFile });
    const result = await giteaService.getFileContent({
      owner:     "test-owner",
      path:      "package.json",
      reference: "main",
      repo:      "test-repo",
    });
    expect(result).toStrictEqual(mockFile);
    expect(mockGet).toHaveBeenCalledWith(
      "/repos/test-owner/test-repo/contents/package.json",
      { params: { ref: "main" } },
    );
  });

  it("should return null when file is not found (404)", async() => {
    expect.assertions(1);
    const axiosError = new AxiosError("Not Found");
    axiosError.response = { status: 404 } as AxiosResponse;
    mockGet.mockRejectedValueOnce(axiosError);
    const result = await giteaService.getFileContent({
      owner: "test-owner",
      path:  "non-existent.json",
      repo:  "test-repo",
    });
    expect(result).toBeNull();
  });

  it("should throw for non-404 errors", async() => {
    expect.assertions(1);
    const axiosError = new AxiosError("Server Error");
    axiosError.response = { status: 500 } as AxiosResponse;
    mockGet.mockRejectedValueOnce(axiosError);
    await expect(
      giteaService.getFileContent({
        owner: "test-owner",
        path:  "package.json",
        repo:  "test-repo",
      }),
    ).rejects.toThrow();
  });

  it("should fetch all repositories with pagination", async() => {
    expect.assertions(2);
    const page1 = Array.from({ length: 100 }, (_, index) => {
      return createMockRepository({
        cloneUrl: `https://git.nhcarrigan.com/nhcarrigan/repo-${String(index)}.git`,
        fullName: `nhcarrigan/repo-${String(index)}`,
        id:       index,
        name:     `repo-${String(index)}`,
      });
    });
    const page2 = [
      createMockRepository({
        cloneUrl: "https://git.nhcarrigan.com/nhcarrigan/repo-100.git",
        fullName: "nhcarrigan/repo-100",
        id:       100,
        name:     "repo-100",
      }),
    ];
    mockGet.
      mockResolvedValueOnce({ data: page1 }).
      mockResolvedValueOnce({ data: page2 }).
      mockResolvedValueOnce({ data: [] });
    const result = await giteaService.listOrgRepositories();
    expect(result).toHaveLength(101);
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it("should filter out archived repositories", async() => {
    expect.assertions(2);
    const repos = [
      createMockRepository({ archived: true, id: 1, name: "archived-repo" }),
      createMockRepository({ id: 2, name: "active-repo" }),
    ];
    mockGet.
      mockResolvedValueOnce({ data: repos }).
      mockResolvedValueOnce({ data: [] });
    const result = await giteaService.listOrgRepositories();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("active-repo");
  });

  it("should filter out disabled repositories", async() => {
    expect.assertions(2);
    const repos = [
      createMockRepository({ disabled: true, id: 1, name: "disabled-repo" }),
      createMockRepository({ id: 2, name: "enabled-repo" }),
    ];
    mockGet.
      mockResolvedValueOnce({ data: repos }).
      mockResolvedValueOnce({ data: [] });
    const result = await giteaService.listOrgRepositories();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("enabled-repo");
  });

  it("should filter out mirror repositories", async() => {
    expect.assertions(2);
    const repos = [
      createMockRepository({ id: 1, mirror: true, name: "mirror-repo" }),
      createMockRepository({ id: 2, name: "source-repo" }),
    ];
    mockGet.
      mockResolvedValueOnce({ data: repos }).
      mockResolvedValueOnce({ data: [] });
    const result = await giteaService.listOrgRepositories();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("source-repo");
  });

  it("should list pull requests with default state", async() => {
    expect.assertions(2);
    const mockPullRequests = [
      {
        base:   { ref: "main", sha: "abc" },
        body:   "PR 1",
        head:   { ref: "feature-1", sha: "def" },
        id:     1,
        number: 1,
        state:  "open",
        title:  "PR 1",
      },
    ];
    mockGet.mockResolvedValueOnce({ data: mockPullRequests });
    const result = await giteaService.listPullRequests("owner", "repo");
    expect(result).toStrictEqual(mockPullRequests);
    expect(mockGet).toHaveBeenCalledWith(
      "/repos/owner/repo/pulls",
      { params: { state: "open" } },
    );
  });

  it("should list pull requests with specified state", async() => {
    expect.assertions(1);
    mockGet.mockResolvedValueOnce({ data: [] });
    await giteaService.listPullRequests("owner", "repo", "all");
    expect(mockGet).toHaveBeenCalledWith(
      "/repos/owner/repo/pulls",
      { params: { state: "all" } },
    );
  });

  it("should list closed pull requests", async() => {
    expect.assertions(1);
    mockGet.mockResolvedValueOnce({ data: [] });
    await giteaService.listPullRequests("owner", "repo", "closed");
    expect(mockGet).toHaveBeenCalledWith(
      "/repos/owner/repo/pulls",
      { params: { state: "closed" } },
    );
  });
});
