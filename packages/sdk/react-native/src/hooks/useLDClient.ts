import { useContext } from 'react';

import { context, ReactContext } from '../provider/reactContext';

const useLDClient = () => {
  const { client } = useContext<ReactContext>(context);
  return client;
};

export default useLDClient;
