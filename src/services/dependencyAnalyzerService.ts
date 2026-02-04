/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { Logger } from "@nhcarrigan/logger";
import semver from "semver";
import { NpmService } from "./npmService.js";
import type {
  DependencyType,
  DependencyUpdate,
  PackageJson,
} from "../types/package.types.js";

const logger = new Logger("DependencyAnalyzer", process.env.LOG_TOKEN ?? "");

/**
 * Checks if a version string is a valid semver range.
 * @param version - The version string to validate.
 * @returns True if the version is a valid semver range.
 */
const isValidSemverRange = (version: string): boolean => {
  if (version.startsWith("file:")) {
    return false;
  }
  if (version.startsWith("git:")) {
    return false;
  }
  if (version.startsWith("http:")) {
    return false;
  }
  if (version.startsWith("https:")) {
    return false;
  }
  if (version.includes("github:")) {
    return false;
  }
  if (version === "*" || version === "latest") {
    return false;
  }

  return true;
};

/**
 * Removes version prefixes for comparison.
 * @param version - The version string to sanitise.
 * @returns The cleaned version string.
 */
const cleanVersion = (version: string): string => {
  return version.replace(/^[<=>^~]/, "");
};

/**
 * Determines if an update is needed based on version comparison.
 * @param currentVersion - The currently installed version.
 * @param latestVersion - The latest available version.
 * @returns True if an update is needed.
 */
const shouldUpdate = (
  currentVersion: string,
  latestVersion: string,
): boolean => {
  try {
    if (currentVersion === latestVersion) {
      return false;
    }

    return semver.lt(currentVersion, latestVersion);
  } catch (error) {
    void logger.error(
      `Error comparing versions: ${currentVersion} vs ${latestVersion}`,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Catch blocks receive unknown type, cast needed for logger.error
      error as Error,
    );
    return false;
  }
};

/**
 * Service for analysing package dependencies and finding updates.
 */
// eslint-disable-next-line stylistic/padded-blocks -- Blank line needed before JSDoc per lines-around-comment rule
class DependencyAnalyzerService {

  /**
   * Creates a new DependencyAnalyzerService instance.
   * @param npmService - The npm service for fetching package information.
   */
  public constructor(private readonly npmService: NpmService) {}

  /**
   * Analyses a package.json and finds available updates.
   * @param packageJson - The parsed package.json content.
   * @returns Array of available dependency updates.
   */
  public async analyzePackageJson(
    packageJson: PackageJson,
  ): Promise<Array<DependencyUpdate>> {
    const updates: Array<DependencyUpdate> = [];

    const dependencyTypes: Array<DependencyType> = [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ];

    for (const type of dependencyTypes) {
      const deps = packageJson[type];
      if (deps === undefined) {
        continue;
      }

      for (const [ packageName, currentVersion ] of Object.entries(deps)) {
        if (!isValidSemverRange(currentVersion)) {
          continue;
        }

        // eslint-disable-next-line no-await-in-loop -- Sequential dependency checks are required
        const update = await this.checkForUpdate(
          packageName,
          currentVersion,
          type,
        );
        if (update !== null) {
          updates.push(update);
        }
      }
    }

    return updates;
  }

  /**
   * Checks if a specific package has an available update.
   * @param packageName - The name of the package to check.
   * @param currentVersion - The currently installed version.
   * @param type - The dependency category (dependencies, devDependencies, etc.).
   * @returns The update information or null if no update available.
   */
  private async checkForUpdate(
    packageName: string,
    currentVersion: string,
    type: DependencyType,
  ): Promise<DependencyUpdate | null> {
    try {
      const packageInfo = await this.npmService.getPackageInfo(packageName);
      if (packageInfo === null) {
        return null;
      }

      // Use mature version (at least 10 days old) instead of dist-tags.latest
      const latestVersion = NpmService.getLatestMatureVersion(
        packageInfo,
        10,
      );
      if (latestVersion === null) {
        return null;
      }

      const cleanCurrentVersion = cleanVersion(currentVersion);

      if (shouldUpdate(cleanCurrentVersion, latestVersion)) {
        return {
          currentVersion,
          latestVersion,
          packageName,
          type,
        };
      }

      return null;
    } catch (error) {
      await logger.error(
        `Error checking update for ${packageName}`,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Catch blocks receive unknown type, cast needed for logger.error
        error as Error,
      );
      return null;
    }
  }
}

export { DependencyAnalyzerService };
