import { useContext } from 'react';

import { context, ReactSdkContext } from '../provider/reactSdkContext';

const useLDClient = () => {
  const { ldClient } = useContext<ReactSdkContext>(context);
  return ldClient;
};

export default useLDClient;
