module.exports = {
  displayName             : 'Mubble/Core',
  "roots"                 : ["<rootDir>/src"],
  "testMatch"             : [
                              "**/__tests__/**/*.+(ts|tsx|js)",
                              "**/?(*.)+(spec|test).+(ts|tsx|js)"
                            ],
  "transform"             : {
                              "^.+\\.(ts|tsx)$": "ts-jest"
                            },
  collectCoverage         : true,
  coverageReporters       : ['html'],
  coverageDirectory       : '<rootDir>/coverage'
}