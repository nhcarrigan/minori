/**
 * @copyright nhcarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { exec } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { config } from "../config.js";
import type { Logger } from "@nhcarrigan/logger";

const execAsync = promisify(exec);

interface ClonedRepository {
  cleanup:  ()=> Promise<void>;
  path:     string;
  repoName: string;
}

type UpdateResult =
  | { branchName: string; status: "created" }
  | { branchName: string; status: "updated" }
  | { error: string; status: "failed" }
  | { status: "up-to-date" };

interface PackageJsonDeps {
  dependencies?:    Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface UpdatePackageOptions {
  logger:        Logger;
  packageName:   string;
  repoPath:      string;
  targetVersion: string;
}

interface BranchUpdateOptions {
  branchName:    string;
  clonedRepo:    ClonedRepository;
  logger:        Logger;
  packageName:   string;
  targetVersion: string;
}

/**
 * Runs a git command in the specified directory.
 * @param logger - The logger instance.
 * @param cwd - The working directory.
 * @param command - The git command to run.
 * @returns The command output.
 */
const runGitCommand = async(
  logger: Logger,
  cwd: string,
  command: string,
): Promise<string> => {
  try {
    const { stderr, stdout } = await execAsync(command, { cwd });
    if (stderr.length > 0 && !stderr.includes("warning:")) {
      void logger.log("debug", `Git stderr: ${stderr}`);
    }
    return stdout.trim();
  } catch (error: unknown) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Error type needs cast to access stderr property
    const gitError = error as Error & { stderr?: string };
    throw new Error(
      `Git command failed: ${command}\n${gitError.stderr ?? gitError.message}`,
    );
  }
};

/**
 * Gets the current version of a package from package.json.
 * @param repoPath - The repository path.
 * @param packageName - The name of the package to look up.
 * @returns The current version or null if not found.
 */
const getCurrentVersionOnBranch = async(
  repoPath: string,
  packageName: string,
): Promise<null | string> => {
  const packageJsonPath = join(repoPath, "package.json");
  const packageJsonContent = await readFile(packageJsonPath, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Dynamic JSON parsing requires type assertion
  const packageJson: PackageJsonDeps = JSON.parse(packageJsonContent);

  return (
    packageJson.dependencies?.[packageName]
    ?? packageJson.devDependencies?.[packageName]
    ?? null
  );
};

/**
 * Runs pnpm install in the specified directory.
 * @param logger - The logger instance.
 * @param repoPath - The repository path.
 */
const runPnpmInstall = async(
  logger: Logger,
  repoPath: string,
): Promise<void> => {
  const pnpmPath = "/home/naomi/.local/share/pnpm/pnpm";
  /* eslint-disable capitalized-comments -- v8 coverage requires lowercase */
  /* v8 ignore start -- @preserve */
  /* eslint-enable capitalized-comments -- Re-enable rule */
  const pnpmEnvironment = {
    ...process.env,
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Environment variables use SCREAMING_SNAKE_CASE
    HOME: "/home/naomi",
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Environment variables use SCREAMING_SNAKE_CASE
    PATH: `${process.env.PATH ?? ""}:/home/naomi/.local/share/pnpm`,
  };
  /* eslint-disable capitalized-comments -- v8 coverage requires lowercase */
  /* v8 ignore stop -- @preserve */
  /* eslint-enable capitalized-comments -- Re-enable rule */
  try {
    await execAsync(`${pnpmPath} install --no-frozen-lockfile --strict-peer-dependencies=false`, {
      cwd: repoPath,
      env: pnpmEnvironment,
    });
  } catch (pnpmError: unknown) {
    /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Catch blocks receive unknown, cast needed to access stderr/stdout */
    const details = pnpmError as Error & { stderr?: string; stdout?: string };

    // TEMPORARY DEBUG - print full error details to console
    console.log("=== PNPM ERROR DEBUG ===");
    console.log("stderr:", details.stderr);
    console.log("stdout:", details.stdout);
    console.log("message:", details.message);
    console.log("full error:", pnpmError);
    console.log("=== END DEBUG ===");

    /* eslint-disable capitalized-comments -- v8 coverage requires lowercase */
    /* v8 ignore next 5 -- @preserve */
    /* eslint-enable capitalized-comments -- Re-enable rule */
    /* eslint-disable @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing -- Intentionally using || to treat empty strings as falsy */
    const errorMessage = details.stderr || details.stdout || details.message;
    /* eslint-enable @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing -- Re-enable rules */

    void logger.log("info", `pnpm install failed: ${errorMessage}`);
    throw pnpmError;
  }
};

/**
 * Updates package.json and creates a commit.
 * @param options - Configuration for which package to update and where.
 */
const updatePackageAndCommit = async(
  options: UpdatePackageOptions,
): Promise<void> => {
  const { logger, packageName, repoPath, targetVersion } = options;
  const packageJsonPath = join(repoPath, "package.json");
  const packageJsonContent = await readFile(packageJsonPath, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Dynamic JSON parsing requires type assertion
  const packageJson: PackageJsonDeps = JSON.parse(packageJsonContent);

  if (packageJson.dependencies?.[packageName] !== undefined) {
    packageJson.dependencies[packageName] = targetVersion;
  }

  if (packageJson.devDependencies?.[packageName] !== undefined) {
    packageJson.devDependencies[packageName] = targetVersion;
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  void logger.log("info", `Running pnpm install for ${packageName}...`);
  await runPnpmInstall(logger, repoPath);

  await runGitCommand(logger, repoPath, "git add package.json pnpm-lock.yaml");
  const commitMessage = `deps: update ${packageName} to ${targetVersion}`;
  await runGitCommand(logger, repoPath, `git commit -m "${commitMessage}"`);
};

/**
 * Clones a repository to a temporary directory.
 * @param logger - The logger instance.
 * @param repoName - The repository to clone.
 * @param giteaToken - Token for authenticating with the Gitea API.
 * @returns The cloned repository information.
 */
const cloneRepository = async(
  logger: Logger,
  repoName: string,
  giteaToken: string,
): Promise<ClonedRepository> => {
  const timestamp = Date.now();
  const temporaryPath = join(
    tmpdir(),
    `minori-${repoName}-${String(timestamp)}`,
  );

  const giteaHost = config.giteaUrl.replace("https://", "");
  const cloneUrl
    = `https://minori:${giteaToken}@${giteaHost}/${config.giteaOrg}/${repoName}.git`;

  void logger.log("info", `Cloning ${repoName} to ${temporaryPath}...`);
  await execAsync(`git clone ${cloneUrl} ${temporaryPath}`);

  await runGitCommand(
    logger,
    temporaryPath,
    `git config user.email "minori@nhcarrigan.com"`,
  );
  await runGitCommand(logger, temporaryPath, `git config user.name "Minori"`);

  return {
    cleanup: async(): Promise<void> => {
      void logger.log("info", `Cleaning up temp directory for ${repoName}...`);
      await rm(temporaryPath, { force: true, recursive: true });
    },
    path:     temporaryPath,
    repoName: repoName,
  };
};

/**
 * Handles updating an existing branch with a newer version.
 * @param options - The branch update options.
 * @returns The update result.
 */
const handleExistingBranch = async(
  options: BranchUpdateOptions,
): Promise<UpdateResult> => {
  const { branchName, clonedRepo, logger, packageName, targetVersion }
    = options;
  const { path: repoPath } = clonedRepo;

  await runGitCommand(logger, repoPath, `git checkout ${branchName}`);
  await runGitCommand(logger, repoPath, `git pull origin ${branchName}`);

  const currentVersion = await getCurrentVersionOnBranch(repoPath, packageName);

  if (currentVersion === targetVersion) {
    void logger.log(
      "info",
      `Branch ${branchName} is already on version ${targetVersion}, skipping...`,
    );
    await runGitCommand(logger, repoPath, "git checkout main");
    return { status: "up-to-date" };
  }

  void logger.log(
    "info",
    `Branch ${branchName} has version ${currentVersion ?? "unknown"}, updating to ${targetVersion}...`,
  );
  await updatePackageAndCommit({
    logger,
    packageName,
    repoPath,
    targetVersion,
  });

  void logger.log("info", `Pushing updated branch ${branchName}...`);
  await runGitCommand(logger, repoPath, `git push origin ${branchName}`);

  await runGitCommand(logger, repoPath, "git checkout main");
  return { branchName: branchName, status: "updated" };
};

/**
 * Handles creating a branch for a version update.
 * @param options - Configuration for the branch to create.
 * @returns The update result.
 */
const handleNewBranch = async(
  options: BranchUpdateOptions,
): Promise<UpdateResult> => {
  const { branchName, clonedRepo, logger, packageName, targetVersion }
    = options;
  const { path: repoPath } = clonedRepo;

  await runGitCommand(logger, repoPath, "git checkout main");
  await runGitCommand(logger, repoPath, `git checkout -b ${branchName}`);

  const currentVersion = await getCurrentVersionOnBranch(repoPath, packageName);
  if (currentVersion === null) {
    void logger.log("warn", `Package ${packageName} not found in package.json`);
    await runGitCommand(logger, repoPath, "git checkout main");
    await runGitCommand(logger, repoPath, `git branch -D ${branchName}`);
    return {
      error:  `Package ${packageName} not found in package.json`,
      status: "failed",
    };
  }

  await updatePackageAndCommit({
    logger,
    packageName,
    repoPath,
    targetVersion,
  });

  void logger.log("info", `Pushing new branch ${branchName}...`);
  await runGitCommand(logger, repoPath, `git push -u origin ${branchName}`);

  await runGitCommand(logger, repoPath, "git checkout main");
  return { branchName: branchName, status: "created" };
};

/**
 * Creates or updates a branch for a dependency update.
 * @param options - Configuration for the branch operation.
 * @returns The result of the operation.
 */
const createOrUpdateBranch = async(
  options: BranchUpdateOptions,
): Promise<UpdateResult> => {
  const { branchName, clonedRepo, logger } = options;
  const { path: repoPath } = clonedRepo;

  try {
    await runGitCommand(logger, repoPath, "git fetch origin");
    const remoteBranches = await runGitCommand(
      logger,
      repoPath,
      "git branch -r",
    );
    const branchExists = remoteBranches.includes(`origin/${branchName}`);

    if (branchExists) {
      return await handleExistingBranch(options);
    }

    return await handleNewBranch(options);
  } catch (error: unknown) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Catch blocks receive unknown type, cast needed for logger.error
    void logger.error("createOrUpdateBranch", error as Error);
    try {
      await runGitCommand(logger, repoPath, "git checkout main");
    } catch {
      // Ignore cleanup errors
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Catch blocks receive unknown type, cast needed to access message
    return { error: (error as Error).message, status: "failed" };
  }
};

export type { BranchUpdateOptions, ClonedRepository, UpdateResult };
export { cloneRepository, createOrUpdateBranch };
