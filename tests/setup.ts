/**
 * Jest test setup file
 * Runs before each test file
 */

import { TERRAIN } from '../src/world';

// Store original TERRAIN values for restoration
const originalTerrain = JSON.parse(JSON.stringify(TERRAIN));

// Reset any singleton instances between tests
beforeEach(() => {
  // Reset Config singleton if needed
  const { Config } = require('../src/core/Config');
  // Access private static field to reset
  (Config as any).instance = undefined;
});

// Restore TERRAIN registry after each test to prevent state leakage
afterEach(() => {
  // Restore original TERRAIN values
  Object.keys(originalTerrain).forEach((key) => {
    if (TERRAIN[key as keyof typeof TERRAIN]) {
      Object.assign(TERRAIN[key as keyof typeof TERRAIN], originalTerrain[key]);
    }
  });
});

// Global test utilities
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

export {};
