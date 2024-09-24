import {
  LDLogger,
  LDOptions as LDOptionsBase,
  OptionMessages,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-client-sdk-common';

/**
 * Initialization options for the LaunchDarkly browser SDK.
 */
export interface BrowserOptions extends Omit<LDOptionsBase, 'initialConnectionMode'> {
  /**
   * Whether the client should make a request to LaunchDarkly for Experimentation metrics (goals).
   *
   * This is true by default, meaning that this request will be made on every page load.
   * Set it to false if you are not using Experimentation and want to skip the request.
   */
  fetchGoals?: boolean;

  /**
   * A function which, if present, can change the URL in analytics events to something other
   * than the actual browser URL. It will be called with the current browser URL as a parameter,
   * and returns the value that should be stored in the event's `url` property.
   */
  eventUrlTransformer?: (url: string) => string;

  /**
   * Whether or not to open a streaming connection to LaunchDarkly for live flag updates.
   *
   * If this is true, the client will always attempt to maintain a streaming connection; if false,
   * it never will. If you leave the value undefined (the default), the client will open a streaming
   * connection if you subscribe to `"change"` or `"change:flag-key"` events.
   *
   * This is equivalent to calling `client.setStreaming()` with the same value.
   */
  streaming?: boolean;
}

export interface ValidatedOptions {
  fetchGoals: boolean;
  eventUrlTransformer: (url: string) => string;
  streaming?: boolean;
}

const optDefaults = {
  fetchGoals: true,
  eventUrlTransformer: (url: string) => url,
  streaming: undefined,
};

const validators: { [Property in keyof BrowserOptions]: TypeValidator | undefined } = {
  fetchGoals: TypeValidators.Boolean,
  eventUrlTransformer: TypeValidators.Function,
  streaming: TypeValidators.Boolean,
};

export function filterToBaseOptions(opts: BrowserOptions): LDOptionsBase {
  const baseOptions: LDOptionsBase = { ...opts };

  // Remove any browser specific configuration keys so we don't get warnings from
  // the base implementation for unknown configuration.
  Object.keys(optDefaults).forEach((key) => {
    delete (baseOptions as any)[key];
  });
  return baseOptions;
}

export default function validateOptions(opts: BrowserOptions, logger: LDLogger): ValidatedOptions {
  const output: ValidatedOptions = { ...optDefaults };

  Object.entries(validators).forEach((entry) => {
    const [key, validator] = entry as [keyof BrowserOptions, TypeValidator];
    const value = opts[key];
    if (value !== undefined) {
      if (validator.is(value)) {
        output[key as keyof ValidatedOptions] = value as any;
      } else {
        logger.warn(OptionMessages.wrongOptionType(key, validator.getType(), typeof value));
      }
    }
  });

  return output;
}
