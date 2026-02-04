import { createClient, LDContext, createLDReactProvider, LDReactClientOptions } from '@launchdarkly/react-sdk';
import { LD_CLIENT_SIDE_ID } from './ld-config';


const context: LDContext = {
  kind: 'user',
  name: 'sandy',
  key: 'test-user-key',
};

const options: LDReactClientOptions = {
  // NOTE: I haven't rebased with the fix to this yet.
  streaming: true,
};

const client = createClient(LD_CLIENT_SIDE_ID, context, options);

export const LDReactProvider = createLDReactProvider(client);