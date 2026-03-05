import { useContext, useEffect, useRef, useState } from 'react';

import type { LDReactClient, LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';

export default function useVariationCore<T, R = T>(
  key: string,
  defaultValue: T,
  evaluate: (client: LDReactClient, key: string, defaultValue: T) => R,
  reactContext?: React.Context<LDReactClientContextValue>,
): R {
  const { client, context } = useContext(reactContext ?? LDReactContext);

  // Using refs here to capture the latest defaultValue and evaluate function
  // without making them dependencies of the effect.
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;
  const evaluateRef = useRef(evaluate);
  evaluateRef.current = evaluate;

  const didMountRef = useRef(false);

  const [value, setValue] = useState<R>(() => evaluate(client, key, defaultValue));

  useEffect(() => {
    if (didMountRef.current) {
      // Re-evaluate when key, client, or context changes (not on initial mount).
      // This is to avoid an initial double render that will happen when this hook is
      // first mounted.
      setValue(evaluateRef.current(client, key, defaultValueRef.current));
    }
    didMountRef.current = true;

    const handler = () => setValue(evaluateRef.current(client, key, defaultValueRef.current));
    client.on(`change:${key}`, handler);
    return () => client.off(`change:${key}`, handler);
  }, [client, key, context]);

  return value;
}
