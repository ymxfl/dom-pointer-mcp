export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'esnext',
        target: 'es2020',
        moduleResolution: 'bundler',
        esModuleInterop: true,
        strict: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@mcp-pointer/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
};
