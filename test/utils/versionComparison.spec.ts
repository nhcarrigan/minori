/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites naturally have many cases */
/* eslint-disable max-nested-callbacks -- Vitest structure requires nesting */
/* eslint-disable vitest/prefer-to-be-truthy -- toBe(true) is clearer for boolean functions */
/* eslint-disable vitest/prefer-to-be-falsy -- toBe(false) is clearer for boolean functions */

import { describe, expect, it } from "vitest";
import {
  isMajorVersionBump,
  stripVersionPrefix,
} from "../../src/utils/versionComparison.js";

describe("versionComparison", () => {
  describe("stripVersionPrefix", () => {
    it("should strip caret prefix", () => {
      expect.assertions(1);
      expect(stripVersionPrefix("^1.2.3")).toBe("1.2.3");
    });

    it("should strip tilde prefix", () => {
      expect.assertions(1);
      expect(stripVersionPrefix("~1.2.3")).toBe("1.2.3");
    });

    it("should strip greater than prefix", () => {
      expect.assertions(1);
      expect(stripVersionPrefix(">1.2.3")).toBe("1.2.3");
    });

    it("should strip less than prefix", () => {
      expect.assertions(1);
      expect(stripVersionPrefix("<1.2.3")).toBe("1.2.3");
    });

    it("should strip equals prefix", () => {
      expect.assertions(1);
      expect(stripVersionPrefix("=1.2.3")).toBe("1.2.3");
    });

    it("should strip multiple prefix characters", () => {
      expect.assertions(1);
      expect(stripVersionPrefix(">=1.2.3")).toBe("1.2.3");
    });

    it("should return version without prefix unchanged", () => {
      expect.assertions(1);
      expect(stripVersionPrefix("1.2.3")).toBe("1.2.3");
    });
  });

  describe("isMajorVersionBump", () => {
    it("should detect major version bump", () => {
      expect.assertions(1);
      expect(isMajorVersionBump("1.2.3", "2.0.0")).toBe(true);
    });

    it("should detect major version bump with prefixes", () => {
      expect.assertions(1);
      expect(isMajorVersionBump("^1.2.3", "^2.0.0")).toBe(true);
    });

    it("should not detect minor version bump as major", () => {
      expect.assertions(1);
      expect(isMajorVersionBump("1.2.3", "1.3.0")).toBe(false);
    });

    it("should not detect patch version bump as major", () => {
      expect.assertions(1);
      expect(isMajorVersionBump("1.2.3", "1.2.4")).toBe(false);
    });

    it("should handle version with pre-release tags", () => {
      expect.assertions(1);
      expect(isMajorVersionBump("1.2.3", "2.0.0-beta.1")).toBe(true);
    });

    it("should return false for invalid from version", () => {
      expect.assertions(1);
      expect(isMajorVersionBump("invalid", "2.0.0")).toBe(false);
    });

    it("should return false for invalid to version", () => {
      expect.assertions(1);
      expect(isMajorVersionBump("1.2.3", "invalid")).toBe(false);
    });

    it("should return false for both invalid versions", () => {
      expect.assertions(1);
      expect(isMajorVersionBump("invalid", "also-invalid")).toBe(false);
    });

    it("should handle 0.x.x to 1.x.x as major bump", () => {
      expect.assertions(1);
      expect(isMajorVersionBump("0.9.5", "1.0.0")).toBe(true);
    });

    it("should not detect same version as major bump", () => {
      expect.assertions(1);
      expect(isMajorVersionBump("1.2.3", "1.2.3")).toBe(false);
    });
  });
});
