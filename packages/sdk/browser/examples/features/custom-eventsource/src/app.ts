import { createClient } from '@launchdarkly/js-client-sdk';
import { fetchBrowserEventSource } from '@launchdarkly/js-client-sdk/fetch-eventsource';

// Set clientSideID to your LaunchDarkly client-side ID
const clientSideID = 'LD_CLIENT_SIDE_ID';

// Set flagKey to the feature flag key you want to evaluate
const flagKey = 'LD_FLAG_KEY';

// Set up the evaluation context. This context should appear on your
// LaunchDarkly contexts dashboard soon after you run the demo.
const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

const div = document.createElement('div');
const statusBox = document.createElement('div');
const transportBox = document.createElement('div');

document.body.appendChild(statusBox);
document.body.appendChild(transportBox);
document.body.appendChild(div);

div.appendChild(document.createTextNode('No flag evaluations yet'));
statusBox.appendChild(document.createTextNode('Initializing...'));
transportBox.appendChild(document.createTextNode(''));

const main = async () => {
  // The native browser EventSource API has no way to send a custom HTTP method or a request
  // body, so it cannot do POST-based streaming -- setting `usePost: true` alone throws if the
  // configured EventSource cannot send a custom method. Passing `fetchBrowserEventSource` as the
  // `eventSource` option opts into a fetch()-based transport that CAN send POST with a body,
  // which is what actually lets `usePost` take effect. Open your browser's devtools Network tab
  // and look for a POST request to the streaming endpoint to see this in action.
  //
  // `eventSource` is plumbed in at the platform Requests level, below both data systems, but
  // `usePost` only applies to the FDv2 (`dataSystem`) data source -- FDv1 uses `useReport` instead.
  const ldclient = createClient(clientSideID, context, {
    usePost: true,
    eventSource: fetchBrowserEventSource,
    dataSystem: {},
  });

  const render = () => {
    const flagValue = ldclient.variation(flagKey, false);
    const label = `The ${flagKey} feature flag evaluates to ${flagValue}.`;
    document.body.style.background = flagValue ? '#00844B' : '#373841';
    div.replaceChild(document.createTextNode(label), div.firstChild as Node);
  };

  ldclient.on('error', () => {
    statusBox.replaceChild(
      document.createTextNode('Error caught in client SDK'),
      statusBox.firstChild as Node,
    );
  });

  // Listen for flag changes
  ldclient.on('change', () => {
    render();
  });

  ldclient.start();

  const { status } = await ldclient.waitForInitialization();

  // Both calls are required to actually open a stream: setStreaming forces the foreground mode
  // to 'streaming' instead of the browser default ('one-shot', a single fetch with no ongoing
  // connection), and setConnectionMode overrides the resolved mode outright.
  ldclient.setStreaming(true);
  ldclient.setConnectionMode('streaming');

  if (status === 'complete') {
    statusBox.replaceChild(
      document.createTextNode(`Initialized with context: ${JSON.stringify(ldclient.getContext())}`),
      statusBox.firstChild as Node,
    );
    transportBox.replaceChild(
      document.createTextNode(
        'Streaming via the fetch()-based EventSource under FDv2 (dataSystem), with POST enabled by usePost.',
      ),
      transportBox.firstChild as Node,
    );
  } else if (status === 'failed') {
    statusBox.replaceChild(
      document.createTextNode('Error identifying client'),
      statusBox.firstChild as Node,
    );
  } else if (status === 'timeout') {
    statusBox.replaceChild(
      document.createTextNode('Timeout identifying client'),
      statusBox.firstChild as Node,
    );
  } else {
    statusBox.replaceChild(
      document.createTextNode('Unknown error identifying client'),
      statusBox.firstChild as Node,
    );
  }

  render();
};

main();
