import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer', '@sparticuz/chromium'],
  // Rewrites für Client-Side Routing - direkte URLs zu /history, /dashboard etc. funktionieren
  async rewrites() {
    return [
      {
        source: '/history',
        destination: '/',
      },
      {
        source: '/dashboard',
        destination: '/',
      },
      {
        source: '/planned-scans',
        destination: '/',
      },
      {
        source: '/api-keys',
        destination: '/',
      },
      {
        source: '/settings',
        destination: '/',
      },
    ];
  },
};

export default nextConfig;
