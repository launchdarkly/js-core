import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';
import { parseConnectionString } from '@vercel/edge-config';
import { LDMultiKindContext } from '@launchdarkly/vercel-server-sdk';
import { ldEdgeClient } from 'lib/ldEdgeClient';

export const config = {
  matcher: ['/', '/closed', '/favicon.ico'],
};

export async function middleware(req: NextRequest, context: NextFetchEvent) {
  // for demo purposes, warn when there is no EDGE_CONFIG or LAUNCHDARKLY_CLIENT_SIDE_ID
  if (
    !process.env.EDGE_CONFIG ||
    !process.env.LD_CLIENT_SIDE_ID ||
    !parseConnectionString(process.env.EDGE_CONFIG)
  ) {
    req.nextUrl.pathname = '/missing-edge-config';
    return NextResponse.rewrite(req.nextUrl);
  }

  try {
    const client = await ldEdgeClient.waitForInitialization();
    const flagContext: LDMultiKindContext = {
      kind: 'multi',
      url: {
        key: req.url,
      },
      method: {
        key: req.method,
      },
      'user-agent': {
        key: req.headers.get('user-agent') || 'unknown',
      },
    };

    const { pathname } = req.nextUrl;

    if (pathname === '/favicon.ico') {
      const hotDogFaviconEnabled = await client.variation(
        'enable-hot-dog-favicon',
        flagContext,
        false
      );
      if (hotDogFaviconEnabled) {
        req.nextUrl.pathname = '/hot-dog.ico';
      }

      return NextResponse.rewrite(req.nextUrl);
    }

    const storeClosed = await client.variation('store-closed', flagContext, false);

    if (pathname === '/' && storeClosed) {
      req.nextUrl.pathname = `/closed`;
      return NextResponse.rewrite(new URL('/closed', req.url));
    }

    if (pathname === '/closed') {
      req.nextUrl.pathname === '/';
      return NextResponse.redirect(new URL('/', req.url));
    }

    return;
  } catch (error) {
    console.error(error);
  }
}
