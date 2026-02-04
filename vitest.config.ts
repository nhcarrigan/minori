/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "node_modules/**",
        "prod/**",
        "test/**",
        "*.config.*",
        "src/types/**",
        "src/utils/logger.ts",
        "src/index.ts",
      ],
      include:  [ "src/**/*.ts" ],
      provider: "v8",
      reporter: [ "text", "html", "lcov" ],
    },
    environment: "node",
    globals:     true,
    include:     [ "test/**/*.spec.ts" ],
  },
});
