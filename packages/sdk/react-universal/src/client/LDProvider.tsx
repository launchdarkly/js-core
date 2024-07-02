'use client';

import { initialize, type LDOptions } from 'launchdarkly-js-client-sdk';
import { type PropsWithChildren, useEffect, useState } from 'react';
import React from 'react';

import type { LDContext, LDFlagSet } from '@launchdarkly/node-server-sdk';

import { isServer } from '../isServer';
import type { JSSdk } from '../types';
import { Provider, type ReactContext } from './reactContext';
import { setupListeners } from './setupListeners';

type LDProps = {
  clientSideID: string;
  context: LDContext;
  options?: LDOptions;
};

/**
 * This is the LaunchDarkly Provider which uses the React context api to store
 * and pass data to child components through hooks.
 *
 * @param clientSideID Your LaunchDarkly client side id.
 * @param context The LDContext for evaluation.
 * @param options Configuration options for the js sdk. See {@link LDOptions}.
 * @param children Your react application to be rendered.
 */
export const LDProvider = ({
  clientSideID,
  context,
  options,
  children,
}: PropsWithChildren<LDProps>) => {
  let jsSdk: JSSdk = undefined as any;
  if (!isServer) {
    jsSdk = initialize(clientSideID ?? '', context, options);
  }

  const [state, setState] = useState<ReactContext>({
    jsSdk,
    context,
    bootstrap: options?.bootstrap as LDFlagSet,
  });

  useEffect(() => {
    setupListeners(setState, jsSdk);
  }, []);

  return <Provider value={state}>{children}</Provider>;
};
