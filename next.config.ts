import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
};

export default nextConfig;
