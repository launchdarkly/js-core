import { PropsWithChildren, useMemo } from 'react';

import ReactNativeLDClient from '../ReactNativeLDClient';
import { Provider } from './reactContext';

type LDProps = {
  client: ReactNativeLDClient;
};

/**
 * This is the LaunchDarkly Provider which uses the React context api to store
 * and pass data to child components through hooks.
 *
 * @param client The ReactNativeLDClient object. Initialize this object separately
 * and then set this prop when declaring the LDProvider.
 * @param children
 *
 * @constructor
 */
const LDProvider = ({ client, children }: PropsWithChildren<LDProps>) => {
  // NOTE: this could only provide marginal benefits, if the provider is
  // a child component of a parent that is re-rendering then this
  // may still re-render the context value.
  const clientContext = useMemo(() => ({ client }), [client]);

  return <Provider value={clientContext}>{children}</Provider>;
};

export default LDProvider;
