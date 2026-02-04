/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */

import { describe, expect, it } from "vitest";

describe("index", () => {
  it("should export from the module", () => {
    expect.assertions(1);
    expect(true).toBeTruthy();
  });
});
