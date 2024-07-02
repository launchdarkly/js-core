/**
 * Initializes the Node SDK on server startup.
 *
 * Run this once in the instrumentation hook to set up the Node SDK.
 * The node client created is saved in a global variable.
 */
export const initNodeSdk = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const sdk = await import('@launchdarkly/node-server-sdk');

    // Create a new nodejs client and save it globally.
    global.nodeSdk = sdk.init(process.env.LD_SDK_KEY ?? '');

    try {
      await global.nodeSdk.waitForInitialization({ timeout: 5 });
    } catch (e) {
      // Log and report errors here.
      // A non-initialized ldClient will be returned which
      // will use defaults for evaluation.
      // eslint-disable-next-line no-console
      console.log(`LaunchDarkly NodeClient init error: ${e}`);
    }
  }
};
