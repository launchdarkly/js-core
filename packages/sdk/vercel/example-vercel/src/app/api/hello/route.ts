import { NextResponse } from 'next/server';
import { createClient } from '@vercel/edge-config';
import { init as initLD } from '@launchdarkly/vercel-server-sdk';

export const config = {
  runtime: 'edge',
};

export async function GET() {
  const sdkKey = 'test-sdk-key';
  const flagKey = 'testFlag1';

  // default fallthrough evaluates to true
  const contextFallthrough = { kind: 'user', key: 'test-user-key-1' };

  // matches email targeting rule evaluates to false
  const contextEmailRule = { kind: 'user', key: 'test-user-key-1', email: 'test@gmail.com' };

  const vercelClient = createClient(process.env.EDGE_CONFIG);

  // start using ld
  const client = initLD(sdkKey, vercelClient);
  await client.waitForInitialization();
  const fallthrough = await client.variation(flagKey, contextFallthrough, false);
  const emailRule = await client.variation(flagKey, contextEmailRule, false);
  const flagDetail = await client.variationDetail(flagKey, contextEmailRule, false);
  const allFlags = await client.allFlagsState(contextEmailRule);

  return NextResponse.json({
    flagKey: `${flagKey}`,
    contextKey: `${contextFallthrough.key}`,
    fallthrough,
    emailRule,
    emailRuleDetail: `${JSON.stringify(flagDetail)}`,
    allFlags: `${JSON.stringify(allFlags)}`,
  });
}
