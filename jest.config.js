module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
  globals: {
    'ts-jest': {
      tsconfig: {
        rootDir: '.',
        types: ['node', 'jest'],
      },
    },
  },
};
