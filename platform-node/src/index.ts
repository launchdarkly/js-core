// This file contains temporary code for testing.
import doesItWork from '@launchdarkly/js-server-sdk-common';
import NodeRequests from './NodeRequests';

doesItWork();

const requests = new NodeRequests();

async function runTest() {
  console.log('Making request');
  const res = await requests.fetch('https://www.google.com', {tlsOptions: {
    checkServerIdentity: (name, cert) => {
      console.log('GOT A IDENTITY CHECK', name);
      return undefined;
    },
  }});
  console.log('Got res', res);
  const body = await res.text();
  console.log('Body', body);
}

runTest();
