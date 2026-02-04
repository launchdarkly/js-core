import React, { useState, FormEvent } from 'react';
import logo from './logo.svg';
import './App.css';
import { useFlags } from 'launchdarkly-react-client-sdk';

function App() {
  const flags = useFlags();
  const [flagKey, setFlagKey] = useState('sample-feature');
  const [inputValue, setInputValue] = useState(flagKey);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFlagKey(inputValue.trim() || 'sampleFeature');
  };

  const isOn = flags[flagKey];

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
