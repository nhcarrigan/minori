/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { Logger } from "@nhcarrigan/logger";
import axios, { isAxiosError, type AxiosInstance } from "axios";
import { config } from "../config.js";
import type { NpmPackageInfo } from "../types/package.types.js";

const logger = new Logger("NpmService", process.env.LOG_TOKEN ?? "");

/* eslint-disable @typescript-eslint/naming-convention -- GitHub API response types use snake_case property names */
interface GitHubRelease {
  body?:    string;
  tag_name: string;
}
/* eslint-enable @typescript-eslint/naming-convention -- End GitHub API types */

interface ChangelogOptions {
  fromVersion: string;
  packageName: string;
  toVersion:   string;
}

interface GitHubReleaseOptions {
  fromVersion: string;
  owner:       string;
  repo:        string;
  toVersion:   string;
}

/**
 * Checks if a version is within a range.
 * @param version - The version to check.
 * @param from - The lower bound (exclusive).
 * @param to - The upper bound (inclusive).
 * @returns True if version is in range.
 */
const isVersionInRange = (
  version: string,
  from: string,
  to: string,
): boolean => {
  return version > from && version <= to;
};

/**
 * Extracts repository information from a GitHub URL.
 * @param repoUrl - The repository URL.
 * @returns The owner and repo, or null if not a GitHub URL.
 */
const extractGitHubInfo = (
  repoUrl: string,
): { owner: string; repo: string } | null => {
  if (!repoUrl.includes("github.com")) {
    return null;
  }

  const parts = repoUrl.split("github.com/")[1]?.split("/");
  if (parts === undefined || parts.length < 2) {
    return null;
  }

  const [ owner, repo ] = parts;

  // eslint-disable-next-line capitalized-comments -- v8 coverage ignore directive must be lowercase
  /* v8 ignore next 3 -- @preserve */
  if (owner === undefined || repo === undefined) {
    return null;
  }

  return { owner, repo };
};

/**
 * Normalises a repository URL to HTTPS format.
 * @param url - The original repository URL.
 * @returns The normalised URL.
 */
const normaliseRepoUrl = (url: string): string => {
  return url.
    replace(/^git\+/, "").
    replace(/\.git$/, "").
    replace(/^git:\/\//, "https://").
    replace(/^ssh:\/\/git@/, "https://");
};

/**
 * Fetches release notes from GitHub.
 * @param options - The GitHub release fetch options.
 * @returns Formatted changelog string.
 */
const fetchGitHubReleases = async(
  options: GitHubReleaseOptions,
): Promise<string> => {
  const { fromVersion, owner, repo, toVersion } = options;
  const fallbackMessage = `Updated from ${fromVersion} to ${toVersion}`;

  try {
    const { data: releases } = await axios.get<Array<GitHubRelease>>(
      `https://api.github.com/repos/${owner}/${repo}/releases`,
      {
        /* eslint-disable @typescript-eslint/naming-convention -- HTTP headers use PascalCase by convention */
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
        /* eslint-enable @typescript-eslint/naming-convention -- End HTTP headers */
      },
    );

    const relevantReleases = releases.filter((release) => {
      const tagName = release.tag_name.replace(/^v/, "");
      return isVersionInRange(tagName, fromVersion, toVersion);
    });

    if (relevantReleases.length === 0) {
      return fallbackMessage;
    }

    let changelog = `## Changelog\n\n`;
    for (const release of relevantReleases) {
      const version = release.tag_name;
      const body = release.body ?? "No release notes available";
      changelog = `${changelog}### ${version}\n\n${body}\n\n`;
    }

    return changelog;
  } catch {
    return fallbackMessage;
  }
};

/**
 * Service for interacting with the npm registry.
 */
class NpmService {
  private readonly client: AxiosInstance;

  /**
   * Creates a new NpmService instance.
   */
  public constructor() {
    this.client = axios.create({
      baseURL: config.npmRegistryUrl,
      timeout: 10_000,
    });
  }

  /**
   * Gets the latest version that is at least minimumAgeDays old.
   * @param packageInfo - The package information from npm.
   * @param minimumAgeDays - Minimum days since publication (default 10).
   * @returns The latest mature version, or null if none found.
   */
  public static getLatestMatureVersion(
    packageInfo: NpmPackageInfo,
    minimumAgeDays = 10,
  ): string | null {
    const now = Date.now();
    const minimumAgeMs = minimumAgeDays * 24 * 60 * 60 * 1000;
    const cutoffDate = now - minimumAgeMs;

    const versions = Object.keys(packageInfo.versions);
    const matureVersions = versions.filter((version) => {
      const publishedAt = packageInfo.time[version];
      if (publishedAt === undefined) {
        return false;
      }
      const publishedDate = new Date(publishedAt).getTime();
      return publishedDate <= cutoffDate;
    });

    if (matureVersions.length === 0) {
      return null;
    }

    // Sort by semver (descending) to get the latest mature version
    matureVersions.sort((version1, version2) => {
      return version2.localeCompare(version1, undefined, { numeric: true });
    });

    // eslint-disable-next-line capitalized-comments -- v8 coverage ignore directive must be lowercase
    /* v8 ignore next -- @preserve */
    return matureVersions[0] ?? null;
  }

  /**
   * Fetches changelog information for a package update.
   * @param options - The changelog fetch options.
   * @returns Formatted changelog string.
   */
  public async getPackageChangelog(options: ChangelogOptions): Promise<string> {
    const { fromVersion, packageName, toVersion } = options;
    const fallbackMessage = `Updated from ${fromVersion} to ${toVersion}`;

    try {
      const packageInfo = await this.getPackageInfo(packageName);
      if (packageInfo === null) {
        return `No changelog available for ${packageName}`;
      }

      const repository = packageInfo.versions[toVersion]?.repository;
      if (repository?.url === undefined) {
        return fallbackMessage;
      }

      const repoUrl = normaliseRepoUrl(repository.url);
      const githubInfo = extractGitHubInfo(repoUrl);

      if (githubInfo === null) {
        return fallbackMessage;
      }

      return await fetchGitHubReleases({
        fromVersion: fromVersion,
        owner:       githubInfo.owner,
        repo:        githubInfo.repo,
        toVersion:   toVersion,
      });
    } catch (error) {
      void logger.error(
        `Error fetching changelog for ${packageName}`,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Catch blocks receive unknown type, cast needed for logger.error
        error as Error,
      );
      return fallbackMessage;
    }
  }

  /**
   * Fetches package information from the npm registry.
   * @param packageName - The name of the package to look up.
   * @returns Package info or null if not found.
   */
  public async getPackageInfo(
    packageName: string,
  ): Promise<NpmPackageInfo | null> {
    try {
      const { data } = await this.client.get<NpmPackageInfo>(
        `/${encodeURIComponent(packageName)}`,
      );
      return data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }
}

export { NpmService };
