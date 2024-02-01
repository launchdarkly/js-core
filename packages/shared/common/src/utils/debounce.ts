/**
 * Wait before calling the same function. Useful for expensive calls.
 * Adapted from https://amitd.co/code/typescript/debounce.
 *
 * @return The debounced function.
 *
 * @example
 *
 * ```js
 * const debouncedFunction = debounce(e => {
 *   console.log(e);
 * }, 5000);
 *
 * // Console logs 'Hello world again ' after 5 seconds
 * debouncedFunction('Hello world');
 * debouncedFunction('Hello world again');
 * ```
 * @param fn The function to be debounced.
 * @param delayMs Defaults to 5 seconds.
 */
const debounce = <T extends (...args: any[]) => ReturnType<T>>(
  fn: T,
  delayMs: number = 5000,
): ((...args: Parameters<T>) => void) => {
  let timer: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delayMs);
  };
};

export default debounce;
