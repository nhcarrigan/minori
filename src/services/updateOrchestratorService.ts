/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  isMajorVersionBump,
  stripVersionPrefix,
} from "../utils/versionComparison.js";
import { DependencyAnalyzerService } from "./dependencyAnalyzerService.js";
import { GiteaService } from "./giteaService.js";
import {
  cloneRepository,
  createOrUpdateBranch,
  type ClonedRepository,
} from "./gitService.js";
import { NpmService } from "./npmService.js";
import type { GiteaRepository } from "../types/gitea.types.js";
import type { DependencyUpdate, PackageJson } from "../types/package.types.js";

/**
 * Generates the body content for a PR.
 * @param update - The dependency update information.
 * @param changelog - The changelog content.
 * @returns The formatted PR body.
 */
const generatePRBody = (
  update: DependencyUpdate,
  changelog: string,
): string => {
  return `## Dependency Update

Updates **${update.packageName}** from \`${update.currentVersion}\` to \`${update.latestVersion}\`.

### Type
${update.type}

### Changelog
${changelog}

---
✨ This PR was created by Minori, your friendly dependency updater! 🌸`;
};

/**
 * Logs the result of a branch update operation.
 * @param update - The dependency update being processed.
 * @param result - The branch update operation result.
 * @param result.error - Error message if the operation failed.
 * @param result.status - The operation status (up-to-date, failed, updated, created).
 * @returns True if the PR should be created, false otherwise.
 */
const logBranchUpdateResult = async(
  update: DependencyUpdate,
  result: { error?: string; status: string },
): Promise<boolean> => {
  if (result.status === "up-to-date") {
    await logger.log(
      "info",
      `    ${update.packageName} branch already at ${update.latestVersion}, skipping...`,
    );
    return false;
  }
  if (result.status === "failed") {
    await logger.log(
      "warn",
      `    Failed to update ${update.packageName}: ${result.error ?? "Unknown error"}`,
    );
    return false;
  }
  if (result.status === "updated") {
    await logger.log(
      "info",
      `    Updated existing branch for ${update.packageName} to ${update.latestVersion}`,
    );
    return false;
  }
  return true;
};

/**
 * Service for orchestrating dependency updates across repositories.
 */
class UpdateOrchestratorService {
  private readonly dependencyAnalyzer: DependencyAnalyzerService;
  private readonly giteaService:       GiteaService;
  private readonly giteaToken:         string;
  private readonly npmService:         NpmService;

  /**
   * Creates a new UpdateOrchestratorService instance.
   * @throws Error if GITEA_TOKEN environment variable is not set.
   */
  public constructor() {
    const token = process.env.GITEA_TOKEN;
    if (token === undefined || token === "") {
      throw new Error("GITEA_TOKEN environment variable is required");
    }
    this.giteaToken = token;
    this.giteaService = new GiteaService();
    this.npmService = new NpmService();
    this.dependencyAnalyzer = new DependencyAnalyzerService(this.npmService);
  }

  /**
   * Checks and updates dependencies for all repositories.
   */
  public async checkAndUpdateAllRepositories(): Promise<void> {
    await logger.log(
      "info",
      "Starting dependency update check for all repositories...",
    );

    const repositories = await this.giteaService.listOrgRepositories();
    await logger.log(
      "info",
      `Found ${String(repositories.length)} repositories to check`,
    );

    for (const repo of repositories) {
      try {
        // eslint-disable-next-line no-await-in-loop -- Sequential repository processing is required
        await this.processRepository(repo);
      } catch (error) {
        // eslint-disable-next-line no-await-in-loop -- Sequential processing is required
        await logger.error(
          `Error processing repository ${repo.name}`,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Catch blocks receive unknown type
          error as Error,
        );
      }
    }

    await logger.log("info", "Dependency update check complete!");
  }

  /**
   * Attempts to merge an existing PR after checking CI status.
   * @param repo - The repository information.
   * @param update - The dependency update details.
   * @param matchingPR - The existing PR with head SHA and number.
   * @param matchingPR.head - The PR head information.
   * @param matchingPR.head.sha - The commit SHA to check.
   * @param matchingPR.number - The PR number for merging.
   * @returns True if merge was attempted, false otherwise.
   */
  private async attemptPRMerge(
    repo: GiteaRepository,
    update: DependencyUpdate,
    matchingPR: { head: { sha: string }; number: number },
  ): Promise<boolean> {
    const commitStatus = await this.giteaService.getCommitStatus(
      config.giteaOrg,
      repo.name,
      matchingPR.head.sha,
    );

    if (commitStatus.state !== "success") {
      await logger.log(
        "info",
        `    PR exists for ${update.packageName} but CI status is ${commitStatus.state}, skipping auto-merge...`,
      );
      return true;
    }

    await logger.log(
      "info",
      `    Auto-merging PR for ${update.packageName} (CI passed, non-major bump)...`,
    );

    const merged = await this.giteaService.mergePullRequest(
      config.giteaOrg,
      repo.name,
      matchingPR.number,
    );

    if (merged) {
      await logger.log(
        "info",
        `    Successfully merged PR for ${update.packageName}`,
      );
      return true;
    }

    await logger.log(
      "warn",
      `    Failed to merge PR for ${update.packageName}`,
    );
    return true;
  }

  /**
   * Checks if an existing PR can be auto-merged based on CI status and version bump type.
   * @param repo - The repository information.
   * @param update - The dependency update details.
   * @param branchName - The branch name for the PR.
   * @returns True if the PR exists and was handled, false otherwise.
   */
  private async checkAndMergeExistingPR(
    repo: GiteaRepository,
    update: DependencyUpdate,
    branchName: string,
  ): Promise<boolean> {
    const existingPRs = await this.giteaService.listPullRequests(
      config.giteaOrg,
      repo.name,
      "open",
    );

    const matchingPR = existingPRs.find((pr) => {
      return pr.head.ref === branchName;
    });

    if (matchingPR === undefined) {
      return false;
    }

    const isMajorBump = isMajorVersionBump(
      update.currentVersion,
      update.latestVersion,
    );

    if (isMajorBump) {
      await logger.log(
        "info",
        `    PR exists for ${update.packageName} but is a major version bump, skipping auto-merge...`,
      );
      return true;
    }

    return await this.attemptPRMerge(repo, update, matchingPR);
  }

  /**
   * Creates or updates a PR for a dependency update.
   * @param repo - The repository information.
   * @param update - The dependency update details.
   * @param clonedRepo - The cloned repository.
   */
  private async createUpdatePR(
    repo: GiteaRepository,
    update: DependencyUpdate,
    clonedRepo: ClonedRepository,
  ): Promise<void> {
    const branchName
      = `${config.prBranchPrefix}${update.packageName.replaceAll(/[/@]/g, "-")}`;

    try {
      const existingPRMerged = await this.checkAndMergeExistingPR(
        repo,
        update,
        branchName,
      );

      if (existingPRMerged) {
        return;
      }

      const result = await createOrUpdateBranch({
        branchName:    branchName,
        clonedRepo:    clonedRepo,
        logger:        logger,
        packageName:   update.packageName,
        targetVersion: update.latestVersion,
      });

      const shouldCreatePR = await logBranchUpdateResult(update, result);
      if (!shouldCreatePR) {
        return;
      }

      const changelog = await this.npmService.getPackageChangelog({
        fromVersion: stripVersionPrefix(update.currentVersion),
        packageName: update.packageName,
        toVersion:   update.latestVersion,
      });

      await this.giteaService.createPullRequest({
        base:  repo.default_branch,
        body:  generatePRBody(update, changelog),
        head:  branchName,
        owner: config.giteaOrg,
        repo:  repo.name,
        title: `deps: update ${update.packageName} to ${update.latestVersion}`,
      });

      await logger.log("info", `    Created PR for ${update.packageName}`);
    } catch (error) {
      await logger.error(
        `    Error creating PR for ${update.packageName}`,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Catch blocks receive unknown type
        error as Error,
      );
    }
  }

  /**
   * Processes a single repository for dependency updates.
   * @param repo - The repository to process.
   */
  private async processRepository(repo: GiteaRepository): Promise<void> {
    await logger.log("info", `\nChecking repository: ${repo.name}`);

    const packageJsonFile = await this.giteaService.getFileContent({
      owner:     config.giteaOrg,
      path:      "package.json",
      reference: repo.default_branch,
      repo:      repo.name,
    });

    if (packageJsonFile === null || packageJsonFile.type !== "file") {
      await logger.log("info", `  No package.json found, skipping...`);
      return;
    }

    const packageJsonContent = Buffer.from(
      packageJsonFile.content ?? "",
      "base64",
    ).toString("utf-8");
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Dynamic JSON parsing requires type assertion
    const packageJson: PackageJson = JSON.parse(
      packageJsonContent,
    ) as PackageJson;

    const updates
      = await this.dependencyAnalyzer.analyzePackageJson(packageJson);

    if (updates.length === 0) {
      await logger.log("info", `  All dependencies are up to date!`);
      return;
    }

    await logger.log(
      "info",
      `  Found ${String(updates.length)} dependencies to update`,
    );

    const clonedRepo = await cloneRepository(
      logger,
      repo.name,
      this.giteaToken,
    );

    try {
      for (const update of updates) {
        // eslint-disable-next-line no-await-in-loop -- Sequential update processing is required
        await this.createUpdatePR(repo, update, clonedRepo);
      }
    } finally {
      await clonedRepo.cleanup();
    }
  }
}

export { UpdateOrchestratorService };
