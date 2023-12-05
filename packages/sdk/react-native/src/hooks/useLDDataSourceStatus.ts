import { useContext } from 'react';

import { context, ReactContext } from '../provider/reactContext';

/**
 * Returns information about the LDClient state.
 */
const useLDDataSourceStatus = () => {
  const { dataSource } = useContext<ReactContext>(context);
  return dataSource;
};

export default useLDDataSourceStatus;
