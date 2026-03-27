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
  const { client, context } = useContext(reactContext ?? LDReactContext);
  const ready = client.isReady();

  // Refs are used here so their values are captured and stay updated in the
  // effect hook. These are purposely not dependencies of the effect hook as
  // they should not trigger any changes to the hook state.
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;
  const evaluateRef = useRef(evaluate);
  evaluateRef.current = evaluate;

  const didMountRef = useRef(false);

  const [value, setValue] = useState<R>(() => {
    if (ready) {
      return evaluate(client, key, defaultValue);
    }
    return notReadyDefault ? notReadyDefault(defaultValue) : (defaultValue as unknown as R);
  });

  useEffect(() => {
    if (didMountRef.current && ready) {
      setValue(evaluateRef.current(client, key, defaultValueRef.current));
    }
    didMountRef.current = true;

    const handler = () => setValue(evaluateRef.current(client, key, defaultValueRef.current));
    client.on(`change:${key}`, handler);
    return () => client.off(`change:${key}`, handler);
  }, [client, key, context, ready]);

  return value;
}
