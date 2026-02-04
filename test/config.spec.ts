/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-nested-callbacks -- Vitest structure requires nested callbacks */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("config", () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnvironment };
  });

  afterEach(() => {
    process.env = originalEnvironment;
  });

  it("should have the correct default values", async() => {
    expect.assertions(5);
    process.env.GITEA_TOKEN = "test-token";
    const { config } = await import("../src/config.js");

    expect(config.checkInterval).toBe("0 7 * * *");
    expect(config.giteaOrg).toBe("nhcarrigan");
    expect(config.giteaUrl).toBe("https://git.nhcarrigan.com");
    expect(config.npmRegistryUrl).toBe("https://registry.npmjs.org");
    expect(config.prBranchPrefix).toBe("dependencies/update-");
  });

  it("should use GITEA_TOKEN from environment", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "my-secret-token";
    const { config } = await import("../src/config.js");

    expect(config.giteaToken).toBe("my-secret-token");
  });

  it("should default giteaToken to empty string when not set", async() => {
    expect.assertions(1);
    delete process.env.GITEA_TOKEN;
    const { config } = await import("../src/config.js");

    expect(config.giteaToken).toBe("");
  });

  it("should not throw when GITEA_TOKEN is set", async() => {
    expect.assertions(1);
    process.env.GITEA_TOKEN = "valid-token";
    const { validateConfig } = await import("../src/config.js");

    expect(() => {
      validateConfig();
    }).not.toThrow();
  });

  it("should throw when GITEA_TOKEN is empty", async() => {
    expect.assertions(1);
    delete process.env.GITEA_TOKEN;
    const { validateConfig } = await import("../src/config.js");

    expect(() => {
      validateConfig();
    }).toThrow("GITEA_TOKEN is required");
  });
});
