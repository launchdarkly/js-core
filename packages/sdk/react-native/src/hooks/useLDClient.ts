import { useContext } from 'react';

import { context, ReactSdkContext } from '../provider/reactSdkContext';

const useLDClient = () => {
  const { client } = useContext<ReactSdkContext>(context);
  return client;
};

export default useLDClient;
