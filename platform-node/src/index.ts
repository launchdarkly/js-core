// This file contains temporary code for testing.
import doesItWork from '@launchdarkly/js-server-sdk-common';
import NodePlatform from './NodePlatform';
import NodeRequests from './NodeRequests';

doesItWork();

const platform = new NodePlatform({
  tlsParams: {
    checkServerIdentity: (name, cert) => {
      console.log('GOT A IDENTITY CHECK', name);
      return undefined;
    },
  },
});

async function runTest() {
  console.log('Making request');
  const res = await platform.requests.fetch('https://www.google.com');
  console.log('Got res', res);
  const body = await res.text();
  console.log('Body', body);
}

runTest();
