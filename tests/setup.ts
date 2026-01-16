import { expect, beforeAll, afterAll, afterEach } from 'vitest'

// Configure test environment
beforeAll(() => {
  // Set test environment variables if needed
  process.env.NODE_ENV = 'test'
})

afterAll(() => {
  // Cleanup after all tests
})

afterEach(() => {
  // Reset mocks and cleanup after each test
})

// Custom matchers can be added here if needed
// For example, to test approximate numbers:
expect.extend({
  toBeCloseTo(received: number, expected: number, precision = 2) {
    const pass = Math.abs(received - expected) < Math.pow(10, -precision)
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be close to ${expected}`
          : `Expected ${received} to be close to ${expected} (within ${precision} decimal places)`,
    }
  },
})
