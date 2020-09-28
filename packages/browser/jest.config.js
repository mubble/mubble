const { pathsToModuleNameMapper } = require('ts-jest/utils');
const { compilerOptions } = require('./tsconfig');

module.exports = {
  displayName             : 'Mubble/Browser',
  preset                  : 'jest-preset-angular',
  roots                   : ['<rootDir>/src/'],
  testMatch               : [
                              '**/__tests__/**/*.+(ts|tsx|js)',
                              '**/+(*.)+(spec).+(ts)'
                            ],
  setupFilesAfterEnv      : ['<rootDir>/src/test.ts'],
  collectCoverage         : true,
  coverageReporters       : ['html'],
  coverageDirectory       : '<rootDir>/coverage',
  moduleNameMapper        : pathsToModuleNameMapper(compilerOptions.paths || {}, {
                              prefix : '<rootDir>/'
                            })
};