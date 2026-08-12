import TestHarnessWebSocket from './TestHarnessWebSocket';

function runContractTests() {
  const ws = new TestHarnessWebSocket('ws://localhost:8001');
  ws.connect();
}

runContractTests();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Vue SDK contract test service</h1>
  </div>
`;
