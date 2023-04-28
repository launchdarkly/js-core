import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/edge-config';

export const config = {
  runtime: 'edge',
};

export default async (request: NextRequest) => {
  const exampleValue1 = await get('LD');
  return NextResponse.json({
    example: `This is the value of "LD" in my Edge Config: ${JSON.stringify(exampleValue1)}!`,
  });
};
