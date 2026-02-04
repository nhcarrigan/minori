/**
 * @copyright nhcarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { Logger } from "@nhcarrigan/logger";

const logger = new Logger("Minori", process.env.LOG_TOKEN ?? "");

export { logger };
