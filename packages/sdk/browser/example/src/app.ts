import { initialize } from '@launchdarkly/js-client-sdk';

// Set clientSideID to your LaunchDarkly client-side ID
const clientSideID = '';

// Set flagKey to the feature flag key you want to evaluate
const flagKey = 'sample-feature';

// Set up the evaluation context. This context should appear on your
// LaunchDarkly contexts dashboard soon after you run the demo.
const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

const div = document.createElement('div');
document.body.appendChild(div);
div.appendChild(document.createTextNode('Initializing...'));
try {
  const ldclient = initialize(clientSideID);
  const render = () => {
    const flagValue = ldclient.variation(flagKey, false);
    const label = `The ${flagKey} feature flag evaluates to ${flagValue}.`;
    document.body.style.background = flagValue ? '#00844B' : '#373841';
    div.replaceChild(document.createTextNode(label), div.firstChild as Node);
  };

  ldclient.on('error', () => {
    div.replaceChild(document.createTextNode('Error caught in client SDK'), div.firstChild as Node);
  });

  ldclient.on('change', () => {
    render();
  });

  ldclient.identify(context).catch(() => {
    div.replaceChild(document.createTextNode('Error identifying client'), div.firstChild as Node);
  });
} catch (error) {
  div.replaceChild(
    document.createTextNode(`Error initializing LaunchDarkly client: ${error}`),
    div.firstChild as Node,
  );
  document.body.style.background = '#373841';
}
