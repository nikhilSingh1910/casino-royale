/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  // Integration suites share one Postgres test DB and TRUNCATE between tests, so files must not
  // run concurrently. Serial is fine at this size; split into a per-worker DB if the suite grows.
  maxWorkers: 1,
};
