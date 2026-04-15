import { context, FLAG_HEADER, flagKey, getLdEdgeClient } from 'lib/ldEdgeClient';
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/'],
};

export async function proxy(_request: NextRequest) {
  const ldClient = getLdEdgeClient();
  if (!ldClient) {
    return NextResponse.next();
  }

  try {
    await ldClient.waitForInitialization();
    const flagValue = await ldClient.boolVariation(flagKey, context, false);

    const response = NextResponse.next();
    response.headers.set(FLAG_HEADER, String(flagValue));
    return response;
  } catch {
    return NextResponse.next();
  }
}
