import { context, FLAG_HEADER, flagKey, getLdEdgeClient } from 'lib/ldEdgeClient';
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/'],
};

export async function proxy(request: NextRequest) {
  const ldClient = getLdEdgeClient();
  if (!ldClient) {
    return NextResponse.next();
  }

  try {
    await ldClient.waitForInitialization();
    const flagValue = await ldClient.boolVariation(flagKey, context, false);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(FLAG_HEADER, String(flagValue));

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch {
    return NextResponse.next();
  }
}
