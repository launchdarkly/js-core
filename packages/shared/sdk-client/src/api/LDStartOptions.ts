import { LDIdentifyOptions } from './LDIdentifyOptions';
import { LDWaitForInitializationOptions } from './LDWaitForInitialization';

export interface LDStartOptions extends LDWaitForInitializationOptions {
  /**
   * Optional bootstrap data to use for the identify operation.
   * If {@link LDIdentifyOptions.bootstrap} is provided in identifyOptions, it takes precedence.
   */
  bootstrap?: unknown;

  /**
   * Optional identify options to use for the identify operation.
   * See {@link LDIdentifyOptions} for more information.
   *
   * @remarks
   * Since the first identify option should never be sheddable, the sheddable option is omitted
   * from the interface to avoid confusion.
   */
  identifyOptions?: Omit<LDIdentifyOptions, 'sheddable'>;
}
