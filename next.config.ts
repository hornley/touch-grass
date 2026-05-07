import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['wayne-mba.ostrich-clownfish.ts.net', '*.ngrok-free.app', '*.azurestaticapps.net'],
  serverExternalPackages: ['mongodb'],
};

export default nextConfig;
