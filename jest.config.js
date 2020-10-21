module.exports = {
    testEnvironment: 'node', // make test faster

    // ts preprocessor
    testMatch: ['**/__tests__/**/*.test.ts'],
    preset: 'ts-jest',

    // coverage
    coverageDirectory: '<rootDir>/results/unit/coverage',
    coverageReporters: ['text', 'text-summary', 'lcov'],

    // reporters
    reporters: [
      'default',
      [
        './node_modules/jest-html-reporter',
        {
          pageTitle: 'CHE4Z Explorer for Endevor Unit Test Report',
          outputPath: 'results/unit/results.html',
        },
      ],
    ],
  };
