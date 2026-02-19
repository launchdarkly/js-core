import React, { useState, FormEvent, useContext, useEffect } from 'react';
import logo from './logo.svg';
import './App.css';
import { Context } from './LDClient';
import { LDContext } from '@launchdarkly/react-sdk';

function App() {
  const { client } = useContext(Context);
  const [flagKey, setFlagKey] = useState('sample-feature');
  const [inputValue, setInputValue] = useState(flagKey);

  console.log(client.getInitializationState());

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFlagKey(inputValue.trim() || 'sampleFeature');
  };

  useEffect(() => {
    const changeHandler = (context: LDContext, flags: string[]) => {
      console.log('change from App.tsx', context, flags);
    };
    client.on('change:sample-feature', changeHandler);
    client.start();
    return () => {
      client.off('change:sample-feature', changeHandler);
    };
  }, []);

  const isOn = false;

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Flag key"
            aria-label="Flag key"
          />
          <button type="submit">Update flag</button>
        </form>
        <p>
          <strong>{flagKey}</strong> is {isOn ? <b>on</b> : <b>off</b>}
        </p>
        <a className="App-link" href="https://reactjs.org" target="_blank" rel="noopener noreferrer">
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
