import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  allowedDevOrigins: ['wayne-mba.ostrich-clownfish.ts.net'],
  turbopack: {
    root: '/Users/wayne/dev/touch-grass',
  },
};

export default nextConfig;
