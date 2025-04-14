/**
 * A simple calculator class for testing ARC indexing
 */
export class Calculator {
  /**
   * Adds two numbers
   * @param a First number
   * @param b Second number
   * @returns Sum of a and b
   */
  add(a: number, b: number): number {
    return a + b;
  }

  /**
   * Subtracts second number from first
   * @param a First number
   * @param b Second number to subtract
   * @returns Difference of a and b
   */
  subtract(a: number, b: number): number {
    return a - b;
  }
}

/**
 * A utility function to multiply two numbers
 * @param a First number
 * @param b Second number
 * @returns Product of a and b
 */
export function multiply(a: number, b: number): number {
  return a * b;
}
