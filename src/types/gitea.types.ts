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
/* eslint-enable @typescript-eslint/naming-convention -- End Gitea API types */

export type { GiteaFile, GiteaPullRequest, GiteaRepository };
