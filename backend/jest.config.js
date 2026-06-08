/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/modules/**/*.ts',
    '!src/modules/**/__tests__/**/*.test.ts',
    '!src/modules/**/index.ts',
    '!src/modules/**/schemas.ts'
  ],
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    }
  },
  moduleNameMapper: {
    '^puppeteer$': '<rootDir>/tests/__mocks__/puppeteer.js',
  },
};
