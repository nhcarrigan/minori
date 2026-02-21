/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites require many test cases */
/* eslint-disable max-lines -- Test suites require many test cases */
/* eslint-disable @typescript-eslint/naming-convention -- Test data uses npm package names and destructured imports */

/* eslint-disable max-nested-callbacks -- Vitest structure requires nested callbacks */
/* eslint-disable max-classes-per-file -- Mock classes are needed for each service */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGiteaGetFileContent = vi.fn();
const mockGiteaListOrgRepositories = vi.fn();
const mockGiteaCreatePullRequest = vi.fn();
const mockGiteaListPullRequests = vi.fn();
const mockGiteaGetCommitStatus = vi.fn();
const mockGiteaMergePullRequest = vi.fn();
const mockNpmGetPackageChangelog = vi.fn();
const mockNpmGetPackageInfo = vi.fn();
const mockAnalyzePackageJson = vi.fn();
const mockCloneRepository = vi.fn();
const mockCreateOrUpdateBranch = vi.fn();

vi.mock("@nhcarrigan/logger", () => {
  return {

    Logger: class MockLogger {
      public error = vi.fn();
      public log = vi.fn();
    },
  };
});

vi.mock("../../src/services/giteaService.js", () => {
  return {

    GiteaService: class MockGiteaService {
      public createPullRequest = mockGiteaCreatePullRequest;
      public getCommitStatus = mockGiteaGetCommitStatus;
      public getFileContent = mockGiteaGetFileContent;
      public listOrgRepositories = mockGiteaListOrgRepositories;
      public listPullRequests = mockGiteaListPullRequests;
      public mergePullRequest = mockGiteaMergePullRequest;
    },
  };
});

vi.mock("../../src/services/npmService.js", () => {
  return {

    NpmService: class MockNpmService {
      public getPackageChangelog = mockNpmGetPackageChangelog;
      public getPackageInfo = mockNpmGetPackageInfo;
    },
  };
});

vi.mock("../../src/services/dependencyAnalyzerService.js", () => {
  return {

    DependencyAnalyzerService: class MockDependencyAnalyzerService {
      public analyzePackageJson = mockAnalyzePackageJson;
    },
  };
});

vi.mock("../../src/services/gitService.js", () => {
  return {
    cloneRepository:      mockCloneRepository,
    createOrUpdateBranch: mockCreateOrUpdateBranch,
  };
});

const createMockRepo = (name: string): Record<string, unknown> => {
  return {
    archived:       false,
    clone_url:      "url",
    default_branch: "main",
    disabled:       false,
    full_name:      `nhcarrigan/${name}`,
    id:             1,
    mirror:         false,
    name:           name,
  };
};

interface MockFileContent {
  content?: string;
  encoding: string;
  path:     string;
  sha:      string;
  type:     string;
}

const createMockFileContent = (
  packageJson: Record<string, unknown>,
): MockFileContent => {
  return {
    content:  Buffer.from(JSON.stringify(packageJson)).toString("base64"),
    encoding: "base64",
    path:     "package.json",
    sha:      "abc123",
    type:     "file",
  };
};

interface MockUpdate {
  currentVersion: string;
  latestVersion:  string;
  packageName:    string;
  type:           "dependencies" | "devDependencies";
}

const createMockUpdate = (): MockUpdate => {
  return {
    currentVersion: "1.0.0",
    latestVersion:  "2.0.0",
    packageName:    "test-pkg",
    type:           "dependencies",
  };
};

const createMockClonedRepo = (
  cleanup: ReturnType<typeof vi.fn> = vi.fn(),
): Record<string, unknown> => {
  return {
    cleanup:  cleanup,
    path:     "/tmp/test",
    repoName: "test-repo",
  };
};

describe("updateOrchestratorService", () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnvironment, GITEA_TOKEN: "test-token" };
  });

  afterEach(() => {
    process.env = originalEnvironment;
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("should throw when GITEA_TOKEN is not set", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "";
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    expect(() => {
      return new UpdateOrchestratorService();
    }).toThrow("GITEA_TOKEN environment variable is required");
  });

  it("should throw when GITEA_TOKEN is undefined", async() => {
    expect.assertions(1);
    delete process.env.GITEA_TOKEN;
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    expect(() => {
      return new UpdateOrchestratorService();
    }).toThrow("GITEA_TOKEN environment variable is required");
  });

  it("should create instance when GITEA_TOKEN is set", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "valid-token";
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    expect(() => {
      return new UpdateOrchestratorService();
    }).not.toThrow();
  });

  it("should process all repositories", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("test-repo") ];
    const mockFileContent = createMockFileContent({
      dependencies: { "test-pkg": "1.0.0" },
    });
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockResolvedValue(mockFileContent);
    mockAnalyzePackageJson.mockResolvedValue([]);
    mockCloneRepository.mockResolvedValue(createMockClonedRepo());
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await service.checkAndUpdateAllRepositories();
    expect(mockGiteaListOrgRepositories).toHaveBeenCalledWith();
  });

  it("should skip repositories without package.json", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("no-package") ];
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockResolvedValue(null);
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await service.checkAndUpdateAllRepositories();
    expect(mockGiteaGetFileContent).toHaveBeenCalledWith({
      owner:     "nhcarrigan",
      path:      "package.json",
      reference: "main",
      repo:      "no-package",
    });
  });

  it("should create PRs for updates", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("test-repo") ];
    const mockFileContent = createMockFileContent({
      dependencies: { "test-pkg": "1.0.0" },
    });
    const mockUpdates = [ createMockUpdate() ];
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockResolvedValue(mockFileContent);
    mockGiteaListPullRequests.mockResolvedValue([]);
    mockAnalyzePackageJson.mockResolvedValue(mockUpdates);
    mockNpmGetPackageChangelog.mockResolvedValue("## Changelog");
    mockCloneRepository.mockResolvedValue(createMockClonedRepo());
    mockCreateOrUpdateBranch.mockResolvedValue({
      branchName: "dependencies/update-test-pkg",
      status:     "created",
    });
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await service.checkAndUpdateAllRepositories();
    expect(mockGiteaCreatePullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        base:  "main",
        head:  "dependencies/update-test-pkg",
        owner: "nhcarrigan",
        repo:  "test-repo",
        title: "deps: update test-pkg to 2.0.0",
      }),
    );
  });

  it("should handle repository processing errors", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("error-repo") ];
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockRejectedValue(new Error("API error"));
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await expect(
      service.checkAndUpdateAllRepositories(),
    ).resolves.not.toThrow();
  });

  it("should skip when branch is up-to-date", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("test-repo") ];
    const mockFileContent = createMockFileContent({
      dependencies: { "test-pkg": "1.0.0" },
    });
    const mockUpdates = [ createMockUpdate() ];
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockResolvedValue(mockFileContent);
    mockGiteaListPullRequests.mockResolvedValue([]);
    mockAnalyzePackageJson.mockResolvedValue(mockUpdates);
    mockCloneRepository.mockResolvedValue(createMockClonedRepo());
    mockCreateOrUpdateBranch.mockResolvedValue({
      status: "up-to-date",
    });
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await service.checkAndUpdateAllRepositories();
    expect(mockGiteaCreatePullRequest).not.toHaveBeenCalled();
  });

  it("should handle failed branch updates", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("test-repo") ];
    const mockFileContent = createMockFileContent({
      dependencies: { "test-pkg": "1.0.0" },
    });
    const mockUpdates = [ createMockUpdate() ];
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockResolvedValue(mockFileContent);
    mockGiteaListPullRequests.mockResolvedValue([]);
    mockAnalyzePackageJson.mockResolvedValue(mockUpdates);
    mockCloneRepository.mockResolvedValue(createMockClonedRepo());
    mockCreateOrUpdateBranch.mockResolvedValue({
      error:  "Git error",
      status: "failed",
    });
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await service.checkAndUpdateAllRepositories();
    expect(mockGiteaCreatePullRequest).not.toHaveBeenCalled();
  });

  it("should handle failed branch updates without error message", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("test-repo") ];
    const mockFileContent = createMockFileContent({
      dependencies: { "test-pkg": "1.0.0" },
    });
    const mockUpdates = [ createMockUpdate() ];
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockResolvedValue(mockFileContent);
    mockGiteaListPullRequests.mockResolvedValue([]);
    mockAnalyzePackageJson.mockResolvedValue(mockUpdates);
    mockCloneRepository.mockResolvedValue(createMockClonedRepo());
    mockCreateOrUpdateBranch.mockResolvedValue({
      status: "failed",
    });
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await service.checkAndUpdateAllRepositories();
    expect(mockGiteaCreatePullRequest).not.toHaveBeenCalled();
  });

  it("should handle package.json without content", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("test-repo") ];
    const mockFileContent: MockFileContent = {
      encoding: "base64",
      path:     "package.json",
      sha:      "abc123",
      type:     "file",
    };
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockResolvedValue(mockFileContent);
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await expect(
      service.checkAndUpdateAllRepositories(),
    ).resolves.not.toThrow();
  });

  it("should skip PR creation when branch was updated", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("test-repo") ];
    const mockFileContent = createMockFileContent({
      dependencies: { "test-pkg": "1.0.0" },
    });
    const mockUpdates = [ createMockUpdate() ];
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockResolvedValue(mockFileContent);
    mockGiteaListPullRequests.mockResolvedValue([]);
    mockAnalyzePackageJson.mockResolvedValue(mockUpdates);
    mockCloneRepository.mockResolvedValue(createMockClonedRepo());
    mockCreateOrUpdateBranch.mockResolvedValue({
      branchName: "dependencies/update-test-pkg",
      status:     "updated",
    });
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await service.checkAndUpdateAllRepositories();
    expect(mockGiteaCreatePullRequest).not.toHaveBeenCalled();
  });

  it("should handle PR creation errors", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("test-repo") ];
    const mockFileContent = createMockFileContent({
      dependencies: { "test-pkg": "1.0.0" },
    });
    const mockUpdates = [ createMockUpdate() ];
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockResolvedValue(mockFileContent);
    mockGiteaListPullRequests.mockResolvedValue([]);
    mockAnalyzePackageJson.mockResolvedValue(mockUpdates);
    mockNpmGetPackageChangelog.mockResolvedValue("## Changelog");
    mockCloneRepository.mockResolvedValue(createMockClonedRepo());
    mockCreateOrUpdateBranch.mockResolvedValue({
      branchName: "dependencies/update-test-pkg",
      status:     "created",
    });
    mockGiteaCreatePullRequest.mockRejectedValue(
      new Error("PR creation failed"),
    );
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await expect(
      service.checkAndUpdateAllRepositories(),
    ).resolves.not.toThrow();
  });

  it("should skip non-file type package.json", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("test-repo") ];
    const mockFileContent: MockFileContent = {
      content:  "",
      encoding: "base64",
      path:     "package.json",
      sha:      "abc123",
      type:     "dir",
    };
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockResolvedValue(mockFileContent);
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await service.checkAndUpdateAllRepositories();
    expect(mockAnalyzePackageJson).not.toHaveBeenCalled();
  });

  it("should cleanup cloned repo after processing", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "test-token";
    const mockRepos = [ createMockRepo("test-repo") ];
    const mockFileContent = createMockFileContent({
      dependencies: { "test-pkg": "1.0.0" },
    });
    const mockUpdates = [ createMockUpdate() ];
    const mockCleanup = vi.fn();
    mockGiteaListOrgRepositories.mockResolvedValue(mockRepos);
    mockGiteaGetFileContent.mockResolvedValue(mockFileContent);
    mockGiteaListPullRequests.mockResolvedValue([]);
    mockAnalyzePackageJson.mockResolvedValue(mockUpdates);
    mockCloneRepository.mockResolvedValue(createMockClonedRepo(mockCleanup));
    mockCreateOrUpdateBranch.mockResolvedValue({
      status: "up-to-date",
    });
    const { UpdateOrchestratorService }
      = await import("../../src/services/updateOrchestratorService.js");
    const service = new UpdateOrchestratorService();
    await service.checkAndUpdateAllRepositories();
    expect(mockCleanup).toHaveBeenCalledWith();
  });
});
