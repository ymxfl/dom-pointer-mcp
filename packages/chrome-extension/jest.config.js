export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^@dom-pointer-mcp/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
  globals: {
    IS_DEV: false,
  },
};
