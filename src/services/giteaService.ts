/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import axios, { isAxiosError, type AxiosInstance } from "axios";
import { config } from "../config.js";
import type {
  GiteaCombinedStatus,
  GiteaFile,
  GiteaPullRequest,
  GiteaRepository,
} from "../types/gitea.types.js";

interface CreatePullRequestOptions {
  base:  string;
  body:  string;
  head:  string;
  owner: string;
  repo:  string;
  title: string;
}

interface GetFileContentOptions {
  owner:      string;
  path:       string;
  reference?: string;
  repo:       string;
}

/**
 * Service for interacting with the Gitea API.
 */
class GiteaService {
  private readonly client: AxiosInstance;

  /**
   * Creates a new GiteaService instance.
   * @throws Error if GITEA_TOKEN environment variable is not set.
   */
  public constructor() {
    const token = process.env.GITEA_TOKEN;
    if (token === undefined || token === "") {
      throw new Error("GITEA_TOKEN environment variable is required");
    }

    this.client = axios.create({
      baseURL: `${config.giteaUrl}/api/v1`,
      /* eslint-disable @typescript-eslint/naming-convention -- HTTP headers use PascalCase by convention */
      headers: {
        "Authorization": `token ${token}`,
        "Content-Type":  "application/json",
      },
      /* eslint-enable @typescript-eslint/naming-convention -- End HTTP headers */
    });
  }

  /**
   * Creates a new pull request in a repository.
   * @param options - The PR creation options.
   * @returns The created pull request.
   */
  public async createPullRequest(
    options: CreatePullRequestOptions,
  ): Promise<GiteaPullRequest> {
    const { base, body, head, owner, repo, title } = options;
    const { data } = await this.client.post<GiteaPullRequest>(
      `/repos/${owner}/${repo}/pulls`,
      { base, body, head, title },
    );
    return data;
  }

  /**
   * Gets the content of a file in a repository.
   * @param options - Configuration specifying the file path and repository.
   * @returns The file content or null if not found.
   */
  public async getFileContent(
    options: GetFileContentOptions,
  ): Promise<GiteaFile | null> {
    const { owner, path, reference, repo } = options;
    try {
      const { data } = await this.client.get<GiteaFile>(
        `/repos/${owner}/${repo}/contents/${path}`,
        { params: { ref: reference } },
      );
      return data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Lists all repositories in the configured organisation.
   * @returns Array of non-archived, non-disabled, non-mirror repositories.
   */
  public async listOrgRepositories(): Promise<Array<GiteaRepository>> {
    const repositories: Array<GiteaRepository> = [];
    let page = 1;
    const limit = 100;

    let hasMore = true;
    while (hasMore) {
      // eslint-disable-next-line no-await-in-loop -- Sequential pagination is required here
      const { data } = await this.client.get<Array<GiteaRepository>>(
        `/orgs/${config.giteaOrg}/repos`,
        { params: { limit, page } },
      );

      if (data.length === 0) {
        hasMore = false;
      } else {
        repositories.push(...data);
        page = page + 1;
      }
    }

    return repositories.filter((repo) => {
      return !repo.archived && !repo.disabled && !repo.mirror;
    });
  }

  /**
   * Lists pull requests in a repository.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param state - The PR state filter.
   * @returns Array of pull requests.
   */
  public async listPullRequests(
    owner: string,
    repo: string,
    state: "all" | "closed" | "open" = "open",
  ): Promise<Array<GiteaPullRequest>> {
    const { data } = await this.client.get<Array<GiteaPullRequest>>(
      `/repos/${owner}/${repo}/pulls`,
      { params: { state } },
    );
    return data;
  }

  /**
   * Gets the combined commit status for a specific commit by querying the Gitea API for all status checks.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param sha - The commit SHA to check.
   * @returns The combined status of all checks (pending, success, error, or failure).
   */
  public async getCommitStatus(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<GiteaCombinedStatus> {
    const { data } = await this.client.get<GiteaCombinedStatus>(
      `/repos/${owner}/${repo}/commits/${sha}/status`,
    );
    return data;
  }

  /**
   * Merges a pull request.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param index - The pull request index number.
   * @returns True if the merge was successful, false otherwise.
   */
  public async mergePullRequest(
    owner: string,
    repo: string,
    index: number,
  ): Promise<boolean> {
    try {
      await this.client.post(
        `/repos/${owner}/${repo}/pulls/${String(index)}/merge`,
        {
          /* eslint-disable @typescript-eslint/naming-convention -- Gitea API uses snake_case */
          Do:                        "merge",
          MergeMessageField:         "",
          MergeTitleField:           "",
          delete_branch_after_merge: true,
          force_merge:               false,
          head_commit_id:            "",
          merge_when_checks_succeed: false,
          /* eslint-enable @typescript-eslint/naming-convention -- End Gitea API */
        },
      );
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Deletes a repository branch by name.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param branch - The branch name to remove.
   * @returns True if successful, false otherwise.
   */
  public async deleteBranch(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<boolean> {
    try {
      await this.client.delete(`/repos/${owner}/${repo}/branches/${branch}`);
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        return false;
      }
      throw error;
    }
  }
}

export { GiteaService };
