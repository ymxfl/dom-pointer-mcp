/**
 * Utility function to create a promise that resolves after a specified delay
 * @param ms - Number of milliseconds to wait
 * @returns Promise that resolves after the delay
 */
// eslint-disable-next-line import/prefer-default-export
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
