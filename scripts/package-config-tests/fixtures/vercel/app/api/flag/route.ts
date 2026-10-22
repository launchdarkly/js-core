import { NextResponse } from 'next/server';

import { evaluate } from '../../../lib-ld';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await evaluate('edge-route'));
}
