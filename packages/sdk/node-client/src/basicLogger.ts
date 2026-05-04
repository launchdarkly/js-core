import { format } from 'util';

import {
  BasicLogger,
  BasicLoggerOptions,
  LDLogger,
} from '@launchdarkly/js-client-sdk-common';

/**
 * Provides a basic {@link LDLogger} implementation.
 *
 * Output is written to `console.log` using Node's `util.format` so multiple arguments and
 * format specifiers (`%s`, `%d`, etc.) are formatted the way Node consumers expect.
 *
 * If you do not pass a logger via {@link LDOptions.logger}, the SDK falls back to
 * a logger equivalent to `basicLogger({ level: 'info' })`.
 *
 * @example
 * ```javascript
 * const ldOptions = {
 *   logger: basicLogger({ level: 'warn' }),
 * };
 * ```
 */
export default function basicLogger(options: BasicLoggerOptions = {}): LDLogger {
  return new BasicLogger({
    ...options,
    destination:
      options.destination ??
      ((line: string) => {
        // eslint-disable-next-line no-console
        console.log(line);
      }),
    formatter: options.formatter ?? format,
  });
}
