/**
 * Jest test setup file
 * Runs before each test file
 */

// Reset any singleton instances between tests
beforeEach(() => {
  // Reset Config singleton if needed
  const { Config } = require('../src/core/Config');
  // Access private static field to reset
  (Config as any).instance = undefined;
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
