/* eslint-disable no-console */
// This file contains temporary code for testing.
import NodePlatform from './NodePlatform';

const platform = new NodePlatform({
  tlsParams: {
    checkServerIdentity: (name) => {
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
