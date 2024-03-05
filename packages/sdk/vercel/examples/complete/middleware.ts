import { parseConnectionString } from '@vercel/edge-config';
import { ldEdgeClient } from 'lib/ldEdgeClient';
import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';

import { LDMultiKindContext } from '@launchdarkly/vercel-server-sdk';

export const config = {
  matcher: ['/', '/closed', '/favicon.ico'],
};

export async function middleware(
  { headers, method, nextUrl, url }: NextRequest,
  _context: NextFetchEvent,
) {
  // for demo purposes, warn when there is no EDGE_CONFIG or LAUNCHDARKLY_CLIENT_SIDE_ID
  if (
    !process.env.EDGE_CONFIG ||
    !process.env.LD_CLIENT_SIDE_ID ||
    !parseConnectionString(process.env.EDGE_CONFIG)
  ) {
    return NextResponse.rewrite(new URL('/missing-edge-config', url));
  }

  try {
    const client = await ldEdgeClient.waitForInitialization();
    const flagContext: LDMultiKindContext = {
      kind: 'multi',
      url: {
        key: url,
      },
      method: {
        key: method,
      },
      'user-agent': {
        key: headers.get('user-agent') || 'unknown',
      },
    };

    const { pathname } = nextUrl;

    if (pathname === '/favicon.ico') {
      const hotDogFaviconEnabled = await client.variation(
        'enable-hot-dog-favicon',
        flagContext,
        false,
      );

      return hotDogFaviconEnabled
        ? NextResponse.rewrite(new URL('/hot-dog.ico', url))
        : NextResponse.next();
    }

    const storeClosed = await client.variation('store-closed', flagContext, false);

    if (pathname === '/' && storeClosed) {
      nextUrl.pathname = `/closed`;
      return NextResponse.rewrite(new URL('/closed', url));
    }

    if (pathname === '/closed') {
      nextUrl.pathname = '/';
      return NextResponse.redirect(new URL('/', url));
    }

    return;
  } catch (error) {
    console.error(error);
  }
}
