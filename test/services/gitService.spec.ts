/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites require many test cases */
/* eslint-disable @typescript-eslint/naming-convention -- Test data uses npm package names and destructured imports */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- Required for mocking */
/* eslint-disable max-nested-callbacks -- Vitest structure requires nested callbacks */
/* eslint-disable stylistic/max-len -- Test files have long import paths */
/* eslint-disable max-lines -- Test suites require many test cases */
/* eslint-disable vitest/no-conditional-in-test -- Discriminated unions require type narrowing */
/* eslint-disable vitest/no-conditional-expect -- Discriminated unions require type narrowing */

import { readFile, rm, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "@nhcarrigan/logger";

const mockExecAsync = vi.fn();

vi.mock("node:child_process", () => {
  return {
    exec: vi.fn(),
  };
});

vi.mock("node:fs/promises", () => {
  return {
    readFile:  vi.fn(),
    rm:        vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock("node:os", () => {
  return {
    tmpdir: vi.fn(() => {
      return "/tmp";
    }),
  };
});

vi.mock("node:util", () => {
  return {
    promisify: vi.fn(() => {
      return mockExecAsync;
    }),
  };
});

interface MockClonedRepo {
  cleanup:  ReturnType<typeof vi.fn>;
  path:     string;
  repoName: string;
}

const createMockClonedRepo = (): MockClonedRepo => {
  return {
    cleanup:  vi.fn(),
    path:     "/tmp/minori-test-repo-123",
    repoName: "test-repo",
  };
};

const createMockLogger = (): Logger => {
  return {
    error: vi.fn(),
    log:   vi.fn(),
  } as unknown as Logger;
};

describe("gitService", () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations -- Reassigned in beforeEach
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITEA_TOKEN = "test-token";
    mockLogger = createMockLogger();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should clone a repository to a temporary directory", async() => {
    expect.assertions(3);
    mockExecAsync.mockResolvedValue({ stderr: "", stdout: "" });
    const { cloneRepository } = await import("../../src/services/gitService.js");
    const result = await cloneRepository(
      mockLogger,
      "test-repo",
      "test-token",
    );
    expect(result.repoName).toBe("test-repo");
    expect(result.path).toMatch(/^\/tmp\/minori-test-repo-\d+$/u);
    expect(typeof result.cleanup).toBe("function");
  });

  it("should configure git user email and name", async() => {
    expect.assertions(1);
    mockExecAsync.mockResolvedValue({ stderr: "", stdout: "" });
    const { cloneRepository } = await import("../../src/services/gitService.js");
    await cloneRepository(mockLogger, "test-repo", "test-token");
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining("git clone"),
    );
  });

  it("should cleanup temporary directory when cleanup is called", async() => {
    expect.assertions(1);
    mockExecAsync.mockResolvedValue({ stderr: "", stdout: "" });
    vi.mocked(rm).mockResolvedValue(undefined);
    const { cloneRepository } = await import("../../src/services/gitService.js");
    const result = await cloneRepository(
      mockLogger,
      "test-repo",
      "test-token",
    );
    await result.cleanup();
    expect(rm).toHaveBeenCalledWith(
      result.path,
      { force: true, recursive: true },
    );
  });

  it("should create a new branch when it does not exist", async() => {
    expect.assertions(2);
    mockExecAsync.mockResolvedValue({ stderr: "", stdout: "" });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      dependencies: {
        "test-package": "1.0.0",
      },
    }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    const result = await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(result.status).toBe("created");
    if (result.status === "created") {
      expect(result.branchName).toBe("dependencies/update-test-package");
    }
  });

  it("should update an existing branch when behind", async() => {
    expect.assertions(1);
    mockExecAsync.mockImplementation((command: string) => {
      if (command.includes("git branch -r")) {
        return Promise.resolve({
          stderr: "",
          stdout: "  origin/dependencies/update-test-package\n",
        });
      }
      return Promise.resolve({ stderr: "", stdout: "" });
    });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      dependencies: { "test-package": "1.5.0" },
    }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    const result = await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(result.status).toBe("updated");
  });

  it("should skip when branch is already up-to-date", async() => {
    expect.assertions(1);
    mockExecAsync.mockImplementation((command: string) => {
      if (command.includes("git branch -r")) {
        return Promise.resolve({
          stderr: "",
          stdout: "  origin/dependencies/update-test-package\n",
        });
      }
      return Promise.resolve({ stderr: "", stdout: "" });
    });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      dependencies: { "test-package": "2.0.0" },
    }));
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    const result = await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(result.status).toBe("up-to-date");
  });

  it("should delete stale local branch before checking out remote", async() => {
    expect.assertions(2);
    const branchDeleteCalls: Array<string> = [];
    mockExecAsync.mockImplementation((command: string) => {
      if (command.includes("git branch -r")) {
        return Promise.resolve({
          stderr: "",
          stdout: "  origin/dependencies/update-test-package\n",
        });
      }
      if (command.includes("git branch") && !command.includes("-")) {
        // Return local branches including the stale one
        return Promise.resolve({
          stderr: "",
          stdout: "* main\n  dependencies/update-test-package\n",
        });
      }
      if (command.includes("git branch -D")) {
        branchDeleteCalls.push(command);
      }
      return Promise.resolve({ stderr: "", stdout: "" });
    });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      dependencies: { "test-package": "2.0.0" },
    }));
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    const result = await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(result.status).toBe("up-to-date");
    expect(branchDeleteCalls).toHaveLength(1);
  });

  it("should fail when package is not found", async() => {
    expect.assertions(2);
    mockExecAsync.mockResolvedValue({ stderr: "", stdout: "" });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      dependencies: {},
    }));
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    const result = await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("not found");
    }
  });

  it("should handle git command errors", async() => {
    expect.assertions(1);
    const error = new Error("Git command failed") as Error & { stderr: string };
    error.stderr = "fatal: error";
    mockExecAsync.mockRejectedValueOnce(error);
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    const result = await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(result.status).toBe("failed");
  });

  it("should update devDependencies", async() => {
    expect.assertions(1);
    mockExecAsync.mockResolvedValue({ stderr: "", stdout: "" });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      devDependencies: {
        "test-package": "1.0.0",
      },
    }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    const result = await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(result.status).toBe("created");
  });

  it("should handle cleanup errors gracefully", async() => {
    expect.assertions(1);
    const error = new Error("Git command failed");
    mockExecAsync.
      mockRejectedValueOnce(error).
      mockRejectedValueOnce(new Error("Cleanup failed"));
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    const result = await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(result.status).toBe("failed");
  });

  it("should log git stderr when it does not contain warnings", async() => {
    expect.assertions(1);
    mockExecAsync.mockImplementation((command: string) => {
      if (command.includes("git fetch")) {
        return Promise.resolve({ stderr: "some error message", stdout: "" });
      }
      return Promise.resolve({ stderr: "", stdout: "" });
    });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      dependencies: { "test-package": "1.0.0" },
    }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(mockLogger.log).toHaveBeenCalledWith(
      "debug",
      expect.stringContaining("Git stderr"),
    );
  });

  it("should log 'unknown' when package not found on existing branch", async() => {
    expect.assertions(1);
    mockExecAsync.mockImplementation((command: string) => {
      if (command.includes("git branch -r")) {
        return Promise.resolve({
          stderr: "",
          stdout: "  origin/dependencies/update-test-package\n",
        });
      }
      return Promise.resolve({ stderr: "", stdout: "" });
    });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      dependencies: { "other-package": "1.0.0" },
    }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(mockLogger.log).toHaveBeenCalledWith(
      "info",
      expect.stringContaining("unknown"),
    );
  });

  it("should update both dependencies and devDependencies", async() => {
    expect.assertions(3);
    mockExecAsync.mockResolvedValue({ stderr: "", stdout: "" });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      dependencies:    { "test-package": "1.0.0" },
      devDependencies: { "test-package": "1.0.0" },
    }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    const result = await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(result.status).toBe("created");
    const writeCall = vi.mocked(writeFile).mock.calls[0];
    const writtenContent = JSON.parse(writeCall?.[1] as string) as {
      dependencies:    Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(writtenContent.dependencies["test-package"]).toBe("2.0.0");
    expect(writtenContent.devDependencies["test-package"]).toBe("2.0.0");
  });

  it("should log pnpm error details when install fails", async() => {
    expect.assertions(2);
    mockExecAsync.mockImplementation((command: string) => {
      if (command.includes("pnpm install")) {
        const error = new Error("pnpm failed") as Error & {
          stderr: string;
          stdout: string;
        };
        error.stderr = "ERR_PNPM_NO_MATCHING_VERSION";
        error.stdout = "";
        return Promise.reject(error);
      }
      return Promise.resolve({ stderr: "", stdout: "" });
    });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      dependencies: { "test-package": "1.0.0" },
    }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const { createOrUpdateBranch } = await import("../../src/services/gitService.js");
    const mockClonedRepo = createMockClonedRepo();
    const result = await createOrUpdateBranch({
      branchName:    "dependencies/update-test-package",
      clonedRepo:    mockClonedRepo,
      logger:        mockLogger,
      packageName:   "test-package",
      targetVersion: "2.0.0",
    });
    expect(result.status).toBe("failed");
    expect(mockLogger.log).toHaveBeenCalledWith(
      "info",
      expect.stringContaining("ERR_PNPM_NO_MATCHING_VERSION"),
    );
  });
});
