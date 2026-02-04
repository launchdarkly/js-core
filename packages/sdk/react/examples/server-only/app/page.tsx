import { init } from '@launchdarkly/node-server-sdk';
import { createReactServerClient } from '@launchdarkly/react-sdk/server';
const ldClient = init(process.env.LAUNCHDARKLY_SDK_KEY || '');

const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

const flagKey = 'sample-feature';

const serverClient = createReactServerClient(ldClient, {
  contextProvider: {
    getContext: () => {
      return context;
    },
  }
});

export default async function Home() {

  // We assume this is called elsewhere
  await ldClient.waitForInitialization({timeout: 10});

  const featureFlag = await serverClient.variation(flagKey, false);
  console.log(`Feature flag ${flagKey} is ${featureFlag ? 'enabled' : 'disabled'}`);

  return (
    <>
      {featureFlag ? 'Hello world' : 'Hello world disabled'}
    </>
  );
}
