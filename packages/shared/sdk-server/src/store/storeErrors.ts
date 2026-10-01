/**
 * Converts an unknown rejection or throw reason to an Error whose message is
 * safe to read.
 *
 * The fallback message covers a reason that cannot be converted to a string, for
 * example a null-prototype object or a value whose toString() throws, and an
 * Error whose message accessor throws. Falling back keeps the conversion itself
 * from becoming a second, unhandled failure.
 */
// eslint-disable-next-line import/prefer-default-export
export function toError(reason: unknown, fallbackMessage: string): Error {
  if (reason instanceof Error) {
    try {
      String(reason.message);
      return reason;
    } catch {
      return new Error(fallbackMessage);
    }
  }
  try {
    return new Error(String(reason));
  } catch {
    return new Error(fallbackMessage);
  }
}
