import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

import { LDReactProvider } from './LDClient';

(async () => {

  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <LDReactProvider>
      <App />
    </LDReactProvider>
  );
})();
