/**
 * A basic wrapper to make async methods with callbacks into promises.
 *
 * @param method
 * @returns A promisified version of the method.
 */
export default function promisify<T>(method: (callback: (val: T) => void) => void): Promise<T> {
  return new Promise<T>((resolve) => {
    method((val: T) => {
      resolve(val);
    });
  });
}
