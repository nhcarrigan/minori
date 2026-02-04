/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import cron from "node-cron";
import { config, validateConfig } from "./config.js";
import {
  UpdateOrchestratorService,
} from "./services/updateOrchestratorService.js";
import { logger } from "./utils/logger.js";

/**
 * Main entry point for the application.
 */
const main = async(): Promise<void> => {
  await logger.log("info", "🌸 Minori - Dependency Update Manager");
  await logger.log("info", "=====================================\n");

  try {
    validateConfig();
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Catch blocks receive unknown type, cast needed for logger.error
    await logger.error("Configuration error", error as Error);
    process.exit(1);
  }

  const orchestrator = new UpdateOrchestratorService();

  const runOnce = process.env.RUN_ONCE === "true";

  if (runOnce) {
    await logger.log("info", "Running dependency check once...\n");
    await orchestrator.checkAndUpdateAllRepositories();
    process.exit(0);
  } else {
    await logger.log(
      "info",
      `Scheduling dependency checks: ${config.checkInterval}`,
    );
    await logger.log("info", "Press Ctrl+C to stop\n");

    await orchestrator.checkAndUpdateAllRepositories();

    cron.schedule(config.checkInterval, (): void => {
      void (async(): Promise<void> => {
        await logger.log(
          "info",
          "\n--- Scheduled dependency check starting ---",
        );
        await orchestrator.checkAndUpdateAllRepositories();
      })();
    });
  }
};

process.on("SIGINT", (): void => {
  void logger.log("info", "\n\n✨ Minori shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", (): void => {
  void logger.log("info", "\n\n✨ Minori shutting down gracefully...");
  process.exit(0);
});

// eslint-disable-next-line unicorn/prefer-top-level-await -- Async main pattern requires .catch() for unhandled rejection handling
main().catch((error: unknown): void => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Catch blocks receive unknown type, cast needed for logger.error
  void logger.error("Fatal error", error as Error);
  process.exit(1);
});
