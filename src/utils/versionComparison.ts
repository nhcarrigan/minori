/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/**
 * Strips version prefix characters from a version string.
 * @param version - The version string with potential prefixes.
 * @returns The version without prefix characters.
 */
const stripVersionPrefix = (version: string): string => {
  return version.replace(/^[<=>^~]*/, "");
};

/**
 * Parses a semantic version string into its components.
 * @param version - The version string to parse (e.g., "1.2.3").
 * @returns An object with major, minor, and patch numbers, or null if invalid.
 */
const parseVersion = (
  version: string,
): { major: number; minor: number; patch: number } | null => {
  const cleaned = stripVersionPrefix(version);
  const parts = cleaned.split(".");

  if (parts.length < 3) {
    return null;
  }

  const major = Number.parseInt(parts[0] ?? "0", 10);
  const minor = Number.parseInt(parts[1] ?? "0", 10);
  const patchPart = parts[2] ?? "0";
  const patch = Number.parseInt(patchPart.split("-")[0] ?? "0", 10);

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null;
  }

  return { major, minor, patch };
};

/**
 * Determines if a version update is a major version bump.
 * A major bump occurs when the major version number increases.
 * @param fromVersion - The current version.
 * @param toVersion - The target version.
 * @returns True if this is a major version bump, false otherwise.
 */
const isMajorVersionBump = (
  fromVersion: string,
  toVersion: string,
): boolean => {
  const from = parseVersion(fromVersion);
  const to = parseVersion(toVersion);

  if (from === null || to === null) {
    return false;
  }

  return to.major > from.major;
};

export { isMajorVersionBump, stripVersionPrefix };
