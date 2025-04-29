import {
  LDLogger,
  LDOptions as LDOptionsBase,
  OptionMessages,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-client-sdk-common';

import { LDPlugin } from './LDPlugin';

const DEFAULT_FLUSH_INTERVAL_SECONDS = 2;

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
   *
   * It may be useful to customize the `url` to provide specific meaning, incorporate
   * client-side routing concerns, or redact tokens or other info.
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

  /**
   * Determines if the SDK responds to entering different visibility states, such as foreground and background.
   * An example is flushing buffered events when going to the background.
   *
   * This is true by default. Generally speaking the SDK will be able to most reliably deliver
   * events with this setting on.
   *
   * It may be useful to disable for environments where not all window/document objects are
   * available, such as when running the SDK in a browser extension.
   */
  automaticBackgroundHandling?: boolean;

  /**
   * A list of plugins to be used with the SDK.
   *
   * Plugin support is currently experimental and subject to change.
   */
  plugins?: LDPlugin[];
}

export interface ValidatedOptions {
  fetchGoals: boolean;
  eventUrlTransformer: (url: string) => string;
  streaming?: boolean;
  automaticBackgroundHandling?: boolean;
  plugins: LDPlugin[];
}

const optDefaults = {
  fetchGoals: true,
  eventUrlTransformer: (url: string) => url,
  streaming: undefined,
  plugins: [],
};

const validators: { [Property in keyof BrowserOptions]: TypeValidator | undefined } = {
  fetchGoals: TypeValidators.Boolean,
  eventUrlTransformer: TypeValidators.Function,
  streaming: TypeValidators.Boolean,
  plugins: TypeValidators.createTypeArray('LDPlugin', {}),
};

function withBrowserDefaults(opts: BrowserOptions): BrowserOptions {
  const output = { ...opts };
  output.flushInterval ??= DEFAULT_FLUSH_INTERVAL_SECONDS;
  return output;
}

export function filterToBaseOptionsWithDefaults(opts: BrowserOptions): LDOptionsBase {
  const baseOptions: LDOptionsBase = withBrowserDefaults(opts);

  // Remove any browser specific configuration keys so we don't get warnings from
  // the base implementation for unknown configuration.
  Object.keys(optDefaults).forEach((key) => {
    delete (baseOptions as any)[key];
  });
  return baseOptions;
}

export default function validateBrowserOptions(
  opts: BrowserOptions,
  logger: LDLogger,
): ValidatedOptions {
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
