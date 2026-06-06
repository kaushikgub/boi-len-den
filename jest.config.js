/**
 * Root Jest config for unit/integration tests across all apps and libs.
 * Uses ts-jest; path aliases mirror tsconfig so @app/common and @app/contracts resolve.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['apps/**/*.(t|j)s', 'libs/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@app/contracts(|/.*)$': '<rootDir>/libs/contracts/src/$1',
  },
};
