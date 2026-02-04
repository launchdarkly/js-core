import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { asyncWithLDProvider, LDContext } from 'launchdarkly-react-client-sdk';
import { LD_CLIENT_SIDE_ID } from './ld-config';

(async () => {
  const context: LDContext = {
    kind: 'user',
    key: 'test-user-1',
  };

  const LDProvider = await asyncWithLDProvider({
    clientSideID: LD_CLIENT_SIDE_ID,
    context,
  });

  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <LDProvider>
      <App />
    </LDProvider>
  );

  // If you want to start measuring performance in your app, pass a function
  // to log results (for example: reportWebVitals(console.log))
  // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
  reportWebVitals();
})();
