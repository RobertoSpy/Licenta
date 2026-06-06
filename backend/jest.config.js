module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.spec.ts','**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts','js','json','node'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  }
};
