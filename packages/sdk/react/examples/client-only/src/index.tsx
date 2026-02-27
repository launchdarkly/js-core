import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './index.css';
import { LDReactProvider } from './LDClient';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <LDReactProvider>
    <App />
  </LDReactProvider>,
);
