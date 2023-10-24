import { useContext } from 'react';

import { context, ReactSdkContext } from '../provider/reactSdkContext';

const useLDContextInfo = () => {
  const { ldContextInfo } = useContext<ReactSdkContext>(context);
  return ldContextInfo;
};

export default useLDContextInfo;
