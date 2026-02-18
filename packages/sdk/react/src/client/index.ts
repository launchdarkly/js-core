import { LDReactClient, LDReactClientContextProvider, LDReactClientContextValue } from './LDClient';
import { createContext as createReactContext } from 'react';
import { LDReactClientOptions } from './LDOptions';
import { LDContext } from '@launchdarkly/js-client-sdk';

export type * from '@launchdarkly/js-client-sdk';
export * from './LDClient';
export * from './LDOptions';

/** 
 * Creates a new instance of the LaunchDarkly client.
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
 * @param clientSideID 
 * @param context 
 * @param options 
 * @returns 
 */
// ts-expect-error - TODO: implement this
export function createClient(clientSideID: string, context: LDContext, options?: LDReactClientOptions): LDReactClient {
  // TODO: implement this
  return null as any;
}

/**
 * Creates a new context provider from a LaunchDarkly client instance.
 * 
 * @remarks
 * We export this function so that developers can more easily manage their own client instance.
 * This was how we supported multiple client instances in the past.
 * 
 * we DO NOT recommend using this client creation method.
 *
 * @param client A LaunchDarkly client instance.
 * @returns A LaunchDarkly client context provider.
 */
// ts-expect-error - TODO: implement this
export function createContextFromClient(client: LDReactClient): LDReactClientContextProvider {
  // TODO: implement this
  return null as any;
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
  const Context = createReactContext<LDReactClientContextValue>({
    client,
    context,
    intializedState: 'unknown',
  });

  return {
    Context,
  };
}

