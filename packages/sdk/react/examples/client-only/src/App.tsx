import React, { useState, FormEvent, useContext, useEffect } from 'react';
import logo from './logo.svg';
import './App.css';
import { LDContext, LDReactClientContextValue, LDReactContext } from '@launchdarkly/react-sdk';

function App() {
  // NOTE: we will change this later to use the useLDClient hook instead.
  const { client } = useContext<LDReactClientContextValue>(LDReactContext);
  const [flagKey, setFlagKey] = useState('sample-feature');
  const [inputValue, setInputValue] = useState(flagKey);
  const [isOn, setIsOn] = useState(false);

  console.log(client.getInitializationState());

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFlagKey(inputValue.trim() || 'sample-feature');
  };

  useEffect(() => {
    const changeHandler = (_context: LDContext) => {
      const value = client.variation(flagKey, false)
      setIsOn(value);
    };
    client.on(`change:${flagKey}`, changeHandler);
    client.start();
    return () => {
      client.off(`change:${flagKey}`, changeHandler);
    };
  }, [flagKey, client]);


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
