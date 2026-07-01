import { SocksProxyAgent } from 'socks-proxy-agent';

import { basicLogger, init, type LDLogger } from '@launchdarkly/node-server-sdk';

import { startLocalSocksProxyServer } from './localSocksProxyServer.js';

// The server-side SDK key is read from the LAUNCHDARKLY_SDK_KEY environment variable.
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;

// Set flagKey to the feature flag key you want to evaluate.
const flagKey = process.env.LAUNCHDARKLY_FLAG_KEY || 'sample-feature';

// Point this at a real SOCKS proxy (for example one started with `ssh -D 1080 -N user@host`)
// to exercise it instead of the bundled demo proxy below.
const socksProxyUrl = process.env.SOCKS_PROXY_URL;

if (!sdkKey) {
  console.error(
    '*** LaunchDarkly SDK key is required: set the LAUNCHDARKLY_SDK_KEY environment variable and try again.',
  );
  process.exit(1);
}

const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

async function main(): Promise<void> {
  let proxyAgent: SocksProxyAgent;
  let localProxy: Awaited<ReturnType<typeof startLocalSocksProxyServer>> | undefined;

  if (socksProxyUrl) {
    console.log(`*** Routing SDK traffic through the SOCKS proxy at ${socksProxyUrl}\n`);
    proxyAgent = new SocksProxyAgent(socksProxyUrl);
  } else {
    localProxy = await startLocalSocksProxyServer();
    const localProxyUrl = `socks5h://127.0.0.1:${localProxy.port}`;
    console.log(
      `*** No SOCKS_PROXY_URL set, so this example started a local demo SOCKS5 proxy at ` +
        `${localProxyUrl}.`
    );
    proxyAgent = new SocksProxyAgent(localProxyUrl);
  }

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

  if (localProxy) {
    console.log(
      `*** The local demo SOCKS proxy relayed ${localProxy.connectionCount()} connection(s) ` +
        'for this run, confirming SDK traffic flowed through proxyAgent rather than directly.',
    );
    localProxy.close();
  }

  client.close();
}

main().catch((error) => {
  console.error(`*** Unhandled error: ${error}`);
  process.exit(1);
});
