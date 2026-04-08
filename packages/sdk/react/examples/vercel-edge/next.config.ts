import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // We suppress strict mode for this example to make the render log only one
  // evaluation. While it is correct to double evaluate with strict mode on, that
  // behavior is not immediately obvious to some users.
  reactStrictMode: false,
  turbopack: {
    root: path.resolve(__dirname, '../../../../..'),
  },
};

export default nextConfig;
