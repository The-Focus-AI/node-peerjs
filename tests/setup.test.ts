import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('should run TypeScript tests with Vitest', () => {
    const sum = (a: number, b: number): number => a + b;
    expect(sum(1, 2)).toBe(3);
  });

  it('should support async/await', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
}); 