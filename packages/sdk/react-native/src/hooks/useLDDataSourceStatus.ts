import { useContext } from 'react';

import { context, ReactContext } from '../provider/reactContext';

const useLDDataSourceStatus = () => {
  const { dataSource } = useContext<ReactContext>(context);
  return dataSource;
};

export default useLDDataSourceStatus;
