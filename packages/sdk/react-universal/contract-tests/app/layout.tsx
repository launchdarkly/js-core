'use client';

import React, { useEffect } from 'react';

import AdaptorWebSocket from './websocket';

const ws = new AdaptorWebSocket('ws://localhost:8001');

export default function App() {
  useEffect(() => {
    ws.connect();
    return () => {
      ws.disconnect();
    };
  }, []);

  return (
    <html lang="en">
      <body>
        <div> Hello test harness </div>
      </body>
    </html>
  );
}
