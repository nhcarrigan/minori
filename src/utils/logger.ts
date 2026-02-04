/**
 * @copyright nhcarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

// import { Logger } from "@nhcarrigan/logger";

// const logger = new Logger("Minori", process.env.LOG_TOKEN ?? "");

const logger = {
  error: (message: string, error: Error) => {
    console.error(message, error);
  },
  log:   (level: string, message: string) => {
    console.log(level, message);
  },
};

export { logger };
