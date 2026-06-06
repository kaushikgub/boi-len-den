/**
 * Integration tests (*.int-spec.ts). These require the Docker infra (Postgres)
 * to be up — run `pnpm infra:up` first, then `pnpm test:int`. Kept separate from
 * the hermetic unit suite (`pnpm test`).
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.int-spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  testTimeout: 30000,
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@app/contracts(|/.*)$': '<rootDir>/libs/contracts/src/$1',
  },
};
