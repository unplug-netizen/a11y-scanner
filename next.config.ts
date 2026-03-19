import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer'],
  turbopack: {
    enabled: false,
  },
};

export default nextConfig;
