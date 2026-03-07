import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@launchdarkly/react-sdk'],
};

export default nextConfig;
