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

const ldclient = initialize(clientSideID);

function render() {
  const flagValue = ldclient.variation(flagKey, false);
  const label = `The ${flagKey} feature flag evaluates to ${flagValue}.`;
  document.body.style.background = flagValue ? '#00844B' : '#373841';
  div.replaceChild(document.createTextNode(label), div.firstChild as Node);
}

ldclient.identify(context).then(() => {
  ldclient.on('initialized', () => {
    div.replaceChild(
      document.createTextNode('SDK successfully initialized!'),
      div.firstChild as Node,
    );
  });
  ldclient.on('failed', () => {
    div.replaceChild(document.createTextNode('SDK failed to initialize'), div.firstChild as Node);
  });
  ldclient.on('ready', render);
  ldclient.on('change', render);
});
