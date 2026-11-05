import { createClient } from '@launchdarkly/js-client-sdk';

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

document.body.appendChild(statusBox);
document.body.appendChild(div);

div.appendChild(document.createTextNode('No flag evaluations yet'));
statusBox.appendChild(document.createTextNode('Initializing...'));

const main = async () => {
  const ldclient = createClient(clientSideID, context);
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

  if (status === 'complete') {
    statusBox.replaceChild(
      document.createTextNode(`Initialized with context: ${JSON.stringify(ldclient.getContext())}`),
      statusBox.firstChild as Node,
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
