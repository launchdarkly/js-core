import { useContext, useEffect, useRef, useState } from 'react';

import type { LDReactClient, LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';

export default function useVariationCore<T, R = T>(
  key: string,
  defaultValue: T,
  evaluate: (client: LDReactClient, key: string, defaultValue: T) => R,
  reactContext?: React.Context<LDReactClientContextValue>,
  notReadyDefault?: (defaultValue: T) => R,
): R {
  const { client, context, initializedState } = useContext(reactContext ?? LDReactContext);

  // The ready state is derived from when the client sends the "ready" event
  // which denotes when the client is ready to evaluate flags. See
  // `maybeSetInitializationResult` in `packages/shared/sdk-client/src/LDClientImpl.ts`.
  const ready = initializedState !== 'initializing';

  // Refs are used here so their values are captured and stay updated in the
  // effect hook. These are purposely not dependencies of the effect hook as
  // they should not trigger any changes to the hook state.
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;
  const evaluateRef = useRef(evaluate);
  evaluateRef.current = evaluate;

  const didMountRef = useRef(false);

  // If the client is ready at mount time, evaluate immediately.
  // Otherwise, defer until ready using the notReadyDefault factory if provided
  // (detail hooks use this to return a proper LDEvaluationDetailTyped).
  const [value, setValue] = useState<R>(() => {
    if (ready) {
      return evaluate(client, key, defaultValue);
    }
    return notReadyDefault ? notReadyDefault(defaultValue) : (defaultValue as unknown as R);
  });

  useEffect(() => {
    if (didMountRef.current && readyRef.current) {
      setValue(evaluateRef.current(client, key, defaultValueRef.current));
    }
    didMountRef.current = true;

    const handler = () => setValue(evaluateRef.current(client, key, defaultValueRef.current));
    client.on(`change:${key}`, handler);
    return () => client.off(`change:${key}`, handler);
  }, [client, key, context]);

  return value;
}
