import { useBoolVariation, useInitializationStatus } from '@launchdarkly/react-sdk';

import './App.css';

// Set FLAG_KEY to the feature flag key you want to evaluate.
const FLAG_KEY = import.meta.env.LAUNCHDARKLY_FLAG_KEY ?? 'sample-feature';

function App() {
  const { status } = useInitializationStatus();
  const flagValue = useBoolVariation(FLAG_KEY, false);

  const headerBgColor = flagValue ? '#00844B' : '#373841';

  return (
    <div className="App">
      <header className="App-header" style={{ backgroundColor: headerBgColor }}>
        <p data-testid="flag-value">
          {`The ${FLAG_KEY} feature flag evaluates to ${flagValue}.`}
        </p>
        <p data-testid="status">SDK status: {status}</p>
      </header>
    </div>
  );
}

export default App;
