/**
 * @copyright nhcarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import type { Logger } from "@nhcarrigan/logger";

// Import { Logger } from "@nhcarrigan/logger";

// Const logger = new Logger("Minori", process.env.LOG_TOKEN ?? "");

/* eslint-disable no-console -- Temporary mock logger for development */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- Mock logger requires type assertion */
const logger = {
  error: (message: string, error: Error) => {
    console.error(message, error);
  },
  log: (level: string, message: string) => {
    console.log(level, message);
  },
} as unknown as Logger;
/* eslint-enable no-console, @typescript-eslint/consistent-type-assertions -- Re-enable rules after mock logger */

export { logger };
