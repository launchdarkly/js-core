// eslint-disable-next-line prettier/prettier
import './style.css';
import TestHarnessWebSocket from './TestHarnessWebSocket';

async function runContractTests() {
  const ws = new TestHarnessWebSocket('ws://localhost:8001');
  ws.connect();
}

runContractTests();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Browser contract test service</h1>
    <!--<p>Connected: false</p>-->
  </div>
`;
