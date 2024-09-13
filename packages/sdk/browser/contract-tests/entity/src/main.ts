import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.ts'

import { AutoEnvAttributes, init } from '@launchdarkly/js-client-sdk'

import TestHarnessWebSocket from './TestHarnessWebSocket.ts'

// const client = init('618959580d89aa15579acf1d', AutoEnvAttributes.Enabled);

async function demo() {
  // try {
  // await client.identify({kind: 'user', key: 'bob'});
  // console.log("After identify");
  // } catch(err) {
  //   console.log("Identify error");
  // }

  // console.log("variation", client.boolVariation('my-boolean-flag', false));
  // console.log("Flush result", await client.flush());
  const ws = new TestHarnessWebSocket('ws://localhost:8001');
}


demo();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Browser contract test service</h1>
    <!--<p>Connected: false</p>-->
  </div>
`;
