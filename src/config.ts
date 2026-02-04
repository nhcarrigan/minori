/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

const config = {
  checkInterval:  "0 7 * * *",
  giteaOrg:       "nhcarrigan",
  giteaToken:     process.env.GITEA_TOKEN ?? "",
  giteaUrl:       "https://git.nhcarrigan.com",
  npmRegistryUrl: "https://registry.npmjs.org",
  prBranchPrefix: "dependencies/update-",
};

/**
 * Validates the configuration.
 * @throws Error if required configuration is missing.
 */
const validateConfig = (): void => {
  if (config.giteaToken === "") {
    throw new Error("GITEA_TOKEN is required");
  }
};

export { config, validateConfig };
