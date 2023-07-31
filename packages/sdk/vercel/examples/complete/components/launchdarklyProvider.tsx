'use client';

import { LDContext, LDFlagSet } from 'launchdarkly-js-client-sdk';
import { withLDProvider } from 'launchdarkly-react-client-sdk';
import { ReactNode } from 'react';

type LaunchDarklyProviderProps = {
  envId: string;
  context: LDContext;
  bootstrappedFlags?: LDFlagSet;
  children: ReactNode;
};

/**
 * This returns a client-side component hence the "use client"
 * above is necessary.
 *
 * See the nextjs docs for more info on the "use client" directive:
 * https://nextjs.org/docs/getting-started/react-essentials#the-use-client-directive
 */
export default function LaunchDarklyProvider({
  envId,
  context,
  bootstrappedFlags,
  children,
}: LaunchDarklyProviderProps) {
  const LDProvider = withLDProvider({
    clientSideID: envId,
    context: context,
    reactOptions: {
      // It is important to maintain the same case as the bootstrapped flags
      useCamelCaseFlagKeys: false,
    },
    options: {
      bootstrap: bootstrappedFlags,

      // Streaming is disabled for demo purposes. You can enable it if needed, but keep in mind flags in the Edge Config may be
      // out of date by 10s, so users may experience a content flicker when loading a page immediately after a flag is changed.
      streaming: false,
    },
  })(() => {
    return <>{children}</>;
  });

  return <LDProvider />;
}
