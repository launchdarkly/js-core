'use client';

// The "use client" is necessary here because the LaunchDarkly React SDK returns a client-side component
import { LDContext, LDFlagSet } from 'launchdarkly-js-client-sdk';
import { withLDProvider } from 'launchdarkly-react-client-sdk';
import { ReactNode } from 'react';

type LaunchDarklyProviderProps = {
  envId: string;
  context: LDContext;
  bootstrappedFlags?: LDFlagSet;
  children: ReactNode;
};

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
