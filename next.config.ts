import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer'],
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
