import { LDContextStrict } from '@launchdarkly/react-sdk';

export const defaultContext: LDContextStrict = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};
