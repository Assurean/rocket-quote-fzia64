import type { Config } from '@jest/types'; // @version ^29.6.0

/**
 * Root Jest configuration for backend monorepo
 * Provides shared test settings and configuration for all microservices
 * with comprehensive test coverage and TypeScript support
 */
const jestConfig: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Use Node environment for backend services
  testEnvironment: 'node',

  // Test file discovery settings
  roots: ['<rootDir>/services'],
  testMatch: [
    '**/*.test.ts',
    '**/*.spec.ts'
  ],

  // Coverage collection settings
  collectCoverageFrom: [
    'services/**/*.ts',
    '!services/**/*.d.ts',
    '!services/**/index.ts',
    '!services/**/*.interface.ts',
    '!services/**/proto/*',
    '!services/**/tests/**'
  ],

  // Coverage thresholds enforcing minimum 80% coverage
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Module path aliases matching tsconfig paths
  moduleNameMapper: {
    '@services/(.*)': '<rootDir>/services/$1',
    '@interfaces/(.*)': '<rootDir>/interfaces/$1',
    '@utils/(.*)': '<rootDir>/utils/$1',
    '@config/(.*)': '<rootDir>/config/$1'
  },

  // Test setup and configuration
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 10000,
  maxWorkers: '50%',
  verbose: true,

  // Mock behavior settings
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // File extension handling
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  }
};

export default jestConfig;