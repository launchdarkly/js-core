import './App.css';

import { useBoolVariation, useInitializationStatus } from '@launchdarkly/react-sdk';

// Set FLAG_KEY to the feature flag key you want to evaluate.
const FLAG_KEY = import.meta.env.LAUNCHDARKLY_FLAG_KEY ?? 'sample-feature';

function App() {
  const { status } = useInitializationStatus();
  const flagValue = useBoolVariation(FLAG_KEY, false);

  let statusMessage: string;
  if (status === 'complete') {
    statusMessage = 'SDK successfully initialized!';
  } else if (status === 'failed') {
    statusMessage =
      'SDK failed to initialize. Please check your internet connection and SDK credential for any typo.';
  } else {
    statusMessage = 'Initializing\u2026';
  }

  const ready = status !== 'initializing';
  const headerBgColor = ready && flagValue ? '#00844B' : '#373841';

  return (
    <div className="App">
      <header className="App-header" style={{ backgroundColor: headerBgColor }}>
        {ready && (
          <>
            <p>{statusMessage}</p>
            <p>{`The ${FLAG_KEY} feature flag evaluates to ${flagValue}.`}</p>
          </>
        )}
      </header>
    </div>
  );
}

export default App;
