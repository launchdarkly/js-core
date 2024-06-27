import { useContext } from 'react';

import { LDClientRsc } from '../../ldClientRsc';
import { context as reactContext, type ReactContext } from '../reactContext';

/**
 * Only useLDClient with Client Components.
 */
export const useLDClient = () => {
  const { context, bootstrap, jsSdk } = useContext<ReactContext>(reactContext);

  // TODO: memo construction of LDClientRsc
  return jsSdk ?? new LDClientRsc(context, bootstrap);
};
