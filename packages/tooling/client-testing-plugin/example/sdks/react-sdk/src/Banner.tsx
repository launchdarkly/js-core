import { useBoolVariation, useStringVariation } from '@launchdarkly/react-sdk';

/**
 * A small example component that reads two flags from the React SDK:
 *  - `show-banner` (boolean): whether the banner should render at all.
 *  - `greeting`    (string):  the message shown inside the banner.
 *
 * Defaults are passed to each hook so undefined flag values do not crash the
 * component when the SDK is still initializing or a flag has not been
 * overridden.
 */
export function Banner() {
  const showBanner = useBoolVariation('show-banner', false);
  const greeting = useStringVariation('greeting', 'Hello');

  if (!showBanner) {
    return null;
  }

  return <div role="banner">{greeting}</div>;
}
