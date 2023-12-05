import { useContext } from 'react';

import { context, ReactContext } from '../provider/reactContext';

/**
 * We recommend using the hooks api rather than accessing the LDClient directly.
 *
 * Returns the LDClient object.
 */
const useLDClient = () => {
  const { client } = useContext<ReactContext>(context);
  return client;
};

export default useLDClient;
