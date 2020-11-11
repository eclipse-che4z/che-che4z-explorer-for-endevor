module.exports = {
  testEnvironment: 'node', // make test faster

  // ts preprocessor
  testMatch: ['**/__tests__/**/*-test.ts'],
  preset: 'ts-jest',

  // coverage
  coverageDirectory: '<rootDir>/results/unit/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
};
