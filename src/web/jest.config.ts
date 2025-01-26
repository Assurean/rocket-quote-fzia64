import type { Config } from '@jest/types'; // @version ^29.6.0
import { compilerOptions } from './tsconfig.json';

// Root Jest configuration for the web monorepo
const jestConfig: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript integration
  preset: 'ts-jest',

  // Configure jsdom test environment for React component testing
  testEnvironment: 'jsdom',

  // Test file discovery configuration
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],

  // Module resolution configuration
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    // Package aliases matching tsconfig paths
    '@insurance/shared/(.*)': '<rootDir>/packages/shared/src/$1',
    '@insurance/rtb/(.*)': '<rootDir>/packages/rtb/src/$1',
    '@insurance/analytics/(.*)': '<rootDir>/packages/analytics/src/$1',
    // Handle style imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },

  // TypeScript transformation configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: compilerOptions
    }]
  },

  // Test setup and utilities
  setupFilesAfterEnv: [
    '@testing-library/jest-dom/extend-expect'
  ],

  // Code coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{ts,tsx}',
    '!src/vite-env.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.mock.{ts,tsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],

  // Performance configuration
  maxWorkers: '50%',
  testTimeout: 10000,

  // Watch plugin configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Project references for monorepo structure
  projects: [
    '<rootDir>/apps/consumer/tests',
    '<rootDir>/apps/portal/tests',
    '<rootDir>/packages/shared/tests'
  ],

  // Global settings
  globals: {
    'ts-jest': {
      tsconfig: compilerOptions,
      diagnostics: true,
      isolatedModules: true
    }
  },

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};

export default jestConfig;