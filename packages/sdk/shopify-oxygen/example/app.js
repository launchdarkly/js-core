import {createMiniOxygen} from '@shopify/mini-oxygen';

/**
 * This is script is a simple runner for our example app. This script will run
 * the compiled example on a local worker implementation to emulate a Oxygen worker runtime.
 * 
 * For the actual example implementation, see the src/index.ts file.
 */

const printValueAndBanner = (flagKey, flagValue) => {
  console.log(`*** The '${flagKey}' feature flag evaluates to ${flagValue}.`);

  if (flagValue) {
    console.log(
      `        ██
            ██
        ████████
           ███████
  ██ LAUNCHDARKLY █
           ███████
        ████████
            ██
          ██
  `,
    );
  }
}

const main = async () => {
  // NOTE: you will see logging coming from mini-oxygen's default request hook.
  // https://github.com/Shopify/hydrogen/blob/5a38948133766e358c5f357f52562f6fdcfe7969/packages/mini-oxygen/src/worker/index.ts#L225
  const miniOxygen = createMiniOxygen({
    debug: false,
    workers: [
      {
        name: 'main',
        modules: true,
        scriptPath: 'dist/index.js'
      },
    ],
  });

  miniOxygen.ready.then(() => {
    console.log('Oxygen worker is started...');
    console.log('Press "q" or Ctrl+C to quit...');
    
    // Dispatch fetch every 5 seconds
    const interval = setInterval(() => {
      // NOTE: This is a bogus URL and will not be used in the actual fetch handler.
      // please see the src/index.ts file for the actual fetch handler.
      miniOxygen.dispatchFetch('https://localhost:8000')
        .then(d => d.json())
        .then(({flagValue, flagKey}) => {
          console.clear();
          printValueAndBanner(flagKey, flagValue);
          console.log('Press "q" or Ctrl+C to quit...')
        }).catch((err) => {
          console.log('Error dispatching fetch:', err.message);
          console.log('Press "q" or Ctrl+C to quit...')
        });
    }, 1000);
    
    // Handle keypresses for cleanup
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', async (key) => {
      // Handle Ctrl+C
      if (key === '\u0003') {
        clearInterval(interval);
        await miniOxygen.dispose();
        process.exit();
      }
      
      // Handle 'q' key
      if (key === 'q' || key === 'Q') {
        clearInterval(interval);
        await miniOxygen.dispose();
        process.exit();
      }
    });
  });
}

main().catch(console.error);
