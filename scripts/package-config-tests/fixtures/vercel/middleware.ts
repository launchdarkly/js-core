import { NextResponse } from 'next/server';

import { evaluate } from './lib-ld';

export const config = { matcher: ['/mw'] };

export async function middleware() {
  const result = await evaluate('middleware');
  return NextResponse.json(result, { headers: { 'x-ld-value': String(result.value) } });
}
