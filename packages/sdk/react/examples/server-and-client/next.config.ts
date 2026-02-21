import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    LD_CLIENT_SIDE_ID: process.env.LD_CLIENT_SIDE_ID || '',
    LAUNCHDARKLY_SDK_KEY: process.env.LAUNCHDARKLY_SDK_KEY || '',
  },
};

export default nextConfig;
