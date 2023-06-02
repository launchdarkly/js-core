import { NextResponse } from "next/server";
import { createClient } from "@vercel/edge-config";
import { init as initLD } from "@launchdarkly/vercel-server-sdk";

export const runtime = "edge";

export async function GET() {
  const clientSideID = process.env.LD_CLIENT_SIDE_ID;
  if (!clientSideID) {
    return NextResponse.json(
      {
        error: "LD_CLIENT_SIDE_ID environment variable is missing.",
      },
      { status: 500 }
    );
  }
  const flagKey = "test-flag";

  // This is just a simple example context. You can also include request information such as headers and path or user ID
  //  if the request is authenticated.
  const flagContext = { kind: "user", key: "test-user-key-1" };

  const vercelClient = createClient(process.env.EDGE_CONFIG);

  const client = initLD(clientSideID, vercelClient);
  await client.waitForInitialization();

  // Use .variation() to evaluate a single feature flag for a given context.
  const testFlagVariation = await client.variation(flagKey, flagContext, false);

  // allFlagsState() returns an object containing the variations served for all feature flags for a given context.
  // This is useful for bootstrapping flags for use in the LaunchDarkly React SDK or JS client-side SDK.
  const allFlags = await client.allFlagsState(flagContext);

  return NextResponse.json({
    flagKey: `${flagKey}`,
    context: flagContext,
    variationServed: testFlagVariation,
    allFlags: allFlags.toJSON(),
  });
}
