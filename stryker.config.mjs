/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  reporters: ["clear-text", "progress"],
  mutate: ["src/lib/http/**/*.ts", "!src/**/*.test.ts"],
  thresholds: {
    high: 100,
    low: 100,
    break: 100,
  },
  coverageAnalysis: "perTest",
  concurrency: 4,
};

export default config;
