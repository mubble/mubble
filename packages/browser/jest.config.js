const { pathsToModuleNameMapper } = require('ts-jest/utils');
const { compilerOptions } = require('./tsconfig');

module.exports = {
  preset: 'jest-preset-angular',
  roots: ['<rootDir>/projects/'],
  testMatch: ['**/+(*.)+(spec).+(ts)'],
  setupFilesAfterEnv: ['<rootDir>/setupJest.ts'],
  collectCoverage: true,
  coverageReporters: ['html'],
  coverageDirectory: '<rootDir>/coverage/mu-browser',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, {
    prefix: '<rootDir>/'
  }),
  globals: {
    'ts-jest': {
      tsConfig: "<rootDir>/projects/mu-browser/tsconfig.spec.json"
    }
  }
};
