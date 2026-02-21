/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable @typescript-eslint/naming-convention -- Gitea API response types use snake_case property names */
interface GiteaRepository {
  archived:       boolean;
  clone_url:      string;
  default_branch: string;
  disabled:       boolean;
  full_name:      string;
  id:             number;
  mirror:         boolean;
  name:           string;
}

interface GiteaFile {
  content?:  string;
  encoding?: string;
  path:      string;
  sha:       string;
  type:      string;
}

interface GiteaPullRequest {
  base: {
    ref: string;
    sha: string;
  };
  body: string;
  head: {
    ref: string;
    sha: string;
  };
  id:     number;
  number: number;
  state:  "closed" | "open";
  title:  string;
}

interface GiteaCommitStatus {
  context:     string;
  created_at:  string;
  description: string;
  id:          number;
  state:       "error" | "failure" | "pending" | "success" | "warning";
  target_url:  string;
  updated_at:  string;
  url:         string;
}

interface GiteaCombinedStatus {
  commit_url:  string;
  repository:  GiteaRepository;
  sha:         string;
  state:       "error" | "failure" | "pending" | "success" | "warning";
  statuses:    Array<GiteaCommitStatus>;
  total_count: number;
  url:         string;
}
/* eslint-enable @typescript-eslint/naming-convention -- End Gitea API types */

export type {
  GiteaCombinedStatus,
  GiteaCommitStatus,
  GiteaFile,
  GiteaPullRequest,
  GiteaRepository,
};
