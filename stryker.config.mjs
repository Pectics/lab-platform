/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  reporters: ["clear-text", "progress"],
  mutate: [
    "src/lib/http/**/*.ts",
    "src/lib/domain/**/*.ts",
    "src/lib/security/**/*.ts",
    "src/lib/auth/**/*.ts",
    "src/lib/contracts/**/*.ts",
    "src/lib/subscription/**/*.ts",
    "!src/**/*.test.ts",
    "!src/lib/domain/types.ts",
    "!src/lib/contracts/agent.ts",
    "!src/lib/contracts/projection.ts",
  ],
  thresholds: {
    high: 100,
    low: 100,
    break: 100,
  },
  coverageAnalysis: "perTest",
  concurrency: 4,
};

export default config;
