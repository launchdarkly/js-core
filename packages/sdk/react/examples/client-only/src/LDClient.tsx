import { LDContext } from '@launchdarkly/react-sdk';
import { createClientContext } from '@launchdarkly/react-sdk/client';
import { LD_CLIENT_SIDE_ID } from './ld-config';


const context: LDContext = {
  kind: 'user',
  name: 'sandy',
  key: 'test-user-key',
};

// Perhaps there is a better way to do this so each of these values can be referenced like
// import { Provider, Context } from './LDClient';
export const { Provider, Context } = createClientContext(LD_CLIENT_SIDE_ID, context); 