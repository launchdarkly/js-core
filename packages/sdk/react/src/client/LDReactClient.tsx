import React,{ createContext as createReactContext } from 'react';

import { createClient as createBaseClient, LDContext, LDStartOptions } from '@launchdarkly/js-client-sdk';
import { LDReactClientOptions } from './LDOptions';
import { IntializedState, LDReactClient, LDReactClientContextProvider, LDReactClientContextValue } from './LDClient';

/** 
 * Creates a new instance of the LaunchDarkly client for Reactj.
 * 
 * @remarks
 * This function is exported so that developers can have more flexibility in client creation.
 * More so this is to preserve previous behavior of app developers managing their own client
 * instance.
 * 
 * we DO NOT recommend using this client creation method.
 *
 * @example
 * ```tsx
 * import { createClient } from '@launchdarkly/react';
 * const client = createClient(clientSideID, context, options);
 * ```
 * 
 * @param clientSideID launchdarkly client side id @see https://launchdarkly.com/docs/sdk/concepts/client-side-server-side#client-side-id
 * @param context launchdarkly context @see https://launchdarkly.com/docs/sdk/concepts/context
 * @param options 
 * @returns 
 */
export function createClient(clientSideID: string, context: LDContext, options?: LDReactClientOptions): LDReactClient {
  const baseClient = createBaseClient(clientSideID, context, options);

  let initializationState: IntializedState = 'unknown';

  return {
    ...baseClient,
    start: (options?: LDStartOptions) => {
      initializationState = 'initializing';
      return baseClient.start(options).then((result) => {
        initializationState = result.status;
        return result;
      });
    },
    getInitializationState: () => initializationState,
  };
}


// TODO: maybe make this a new file... we should make a new context creator function that will also
// create all of the hooks that are in scope of the context.
/**
 * Creates a new context provider from a LaunchDarkly client instance.
 * 
 * @remarks
 * We export this function so that developers can more easily manage their own client instance.
 * This was how we supported multiple client instances in the past.
 * 
 * we DO NOT recommend using this client creation method.
 *
 * @param client launchdarkly client instance @see {@link createClient}
 * @returns A LaunchDarkly client context provider.
 */
export function createContextFromClient(client: LDReactClient): LDReactClientContextProvider {
  const contextValue: LDReactClientContextValue = {
    client,
    intializedState: 'unknown',
  };
  const Context = createReactContext<LDReactClientContextValue>(contextValue);

  // TODO: this will need to listen for context changes
  const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Context.Provider value={contextValue}>{children}</Context.Provider>
  );

  return {
    Context,
    Provider,
  };
}

/**
 * Creates a new context provider for the LaunchDarkly client.
 * 
 * TODO: this is unfinished and is only here to provide some reminders
 * of what I was thinking.
 * 
 * @example
 * 
 * ```tsx
 * const { Context, useContext } = createContext();
 *
 * function MyComponent() {
 *   const { client, context, intializedState } = useContext();
 *   return <div>Client: {client.toString()}, Context: {context.toString()}, InitializedState: {intializedState}</div>;
 * }
 * ```
 * 
 * Typically, in React applications, you might want to export the context so that it can be used in other
 * components.
 * 
 * ```tsx
 * export createContext();
 * ```
 * 
 * ```tsx
 * import { Context } from './path/to/context';
 *
 * function MyComponent() {
 *   const { client, context, intializedState } = useContext(Context);
 *   return <div>Client: {client.toString()}, Context: {context.toString()}, InitializedState: {intializedState}</div>;
 * }
 *
 * function MyOtherComponent() {
 *   return <Context value={{ client, context, intializedState }}>
 *     <MyComponent />
 *   </Context>;
 * }
 * ```
 * 
 * @returns The LaunchDarkly client context provider.
 */
export function createClientContext(clientSideID: string, context: LDContext, options?: LDReactClientOptions): LDReactClientContextProvider {
  const client = createClient(clientSideID, context, options);
  return createContextFromClient(client);
}