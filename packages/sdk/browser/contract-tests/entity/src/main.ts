import TestHarnessWebSocket from './TestHarnessWebSocket';

async function runContractTests() {
  // eslint-disable-next-line no-new
  new TestHarnessWebSocket('ws://localhost:8001');
}

runContractTests();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Browser contract test service</h1>
    <!--<p>Connected: false</p>-->
  </div>
`;
