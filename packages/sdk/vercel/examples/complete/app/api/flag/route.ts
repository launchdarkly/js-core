import { context, flagKey, getLdEdgeClient } from 'lib/ldEdgeClient';

export const runtime = 'edge';

export async function GET() {
  const ldClient = getLdEdgeClient();
  if (!ldClient) {
    return Response.json(
      {
        error:
          'LaunchDarkly is not configured: set the LD_CLIENT_SIDE_ID and EDGE_CONFIG environment variables and try again.',
      },
      { status: 500 },
    );
  }

  try {
    await ldClient.waitForInitialization();
    const flagValue = await ldClient.boolVariation(flagKey, context, false);

    return Response.json(
      { flagKey, flagValue },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      {
        error:
          'SDK failed to initialize. Please check your Edge Config connection and LaunchDarkly client-side ID for any issues.',
      },
      { status: 500 },
    );
  }
}
