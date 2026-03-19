import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer'],
  experimental: {
    turbopack: false,
  },
};

export default nextConfig;
