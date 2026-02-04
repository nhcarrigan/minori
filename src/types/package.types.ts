/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

type DependencyType =
  | "dependencies"
  | "devDependencies"
  | "optionalDependencies"
  | "peerDependencies";

interface PackageJson {
  dependencies?:         Record<string, string>;
  devDependencies?:      Record<string, string>;
  name?:                 string;
  optionalDependencies?: Record<string, string>;
  peerDependencies?:     Record<string, string>;
  version?:              string;
}

interface DependencyUpdate {
  currentVersion: string;
  latestVersion:  string;
  packageName:    string;
  type:           DependencyType;
}

/* eslint-disable @typescript-eslint/naming-convention -- Npm registry API response uses hyphenated property names */
interface NpmPackageInfo {
  "dist-tags": {
    [key: string]: string;
    latest:        string;
  };
  "name":     string;
  "time":     Record<string, string>;
  "versions": Record<
    string,
    {
      repository?: {
        url?: string;
      };
      version: string;
    }
  >;
}
/* eslint-enable @typescript-eslint/naming-convention -- End npm API types */

interface ChangelogInfo {
  changes: string;
  version: string;
}

export type {
  ChangelogInfo,
  DependencyType,
  DependencyUpdate,
  NpmPackageInfo,
  PackageJson,
};
