import { SocksProxyAgent } from 'socks-proxy-agent';

import { basicLogger, init, type LDLogger } from '@launchdarkly/node-server-sdk';

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;

// Override with LAUNCHDARKLY_FLAG_KEY to test against a flag other than the sample one.
const flagKey = process.env.LAUNCHDARKLY_FLAG_KEY || 'sample-feature';

// Point this at a SOCKS proxy (for example one started with `ssh -D 1080 -N user@host`, or the
// container described in README.md). This is required: the example routes all SDK traffic
// through it.
const socksProxyUrl = process.env.SOCKS_PROXY_URL;

if (!sdkKey) {
  console.error(
    '*** LaunchDarkly SDK key is required: set the LAUNCHDARKLY_SDK_KEY environment variable and try again.',
  );
  process.exit(1);
}

if (!socksProxyUrl) {
  console.error(
    '*** A SOCKS proxy is required: set the SOCKS_PROXY_URL environment variable (for example socks5h://user:password@127.0.0.1:1080) and try again.',
  );
  process.exit(1);
}

const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

async function main(): Promise<void> {
  console.log(`*** Routing SDK traffic through the SOCKS proxy at ${socksProxyUrl}\n`);
  const proxyAgent = new SocksProxyAgent(socksProxyUrl!);

  const logger: LDLogger = basicLogger({ level: 'warn' });

  // The `proxyAgent` option is a Node-specific escape hatch: the SDK hands every request to
  // this caller-supplied agent instead of building its own connection, so any proxy scheme the
  // agent supports (SOCKS included) works without the SDK needing to know about it.
  const client = init(sdkKey!, {
    proxyAgent,
    logger,
  });

  try {
    await client.waitForInitialization({ timeout: 10 });
    console.log('*** SDK successfully initialized through the SOCKS proxy!\n');
  } catch (error) {
    console.error(
      `*** SDK failed to initialize through the SOCKS proxy. Please check your SDK credential ` +
        `and proxy configuration.\n${error}`,
    );
    process.exit(1);
  }

  const flagValue = await client.variation(flagKey, context, false);
  console.log(`*** The '${flagKey}' feature flag evaluates to ${flagValue}.\n`);

  client.close();
}

main().catch((error) => {
  console.error(`*** Unhandled error: ${error}`);
  process.exit(1);
});
