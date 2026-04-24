import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["child_process"],
  allowedDevOrigins: ["192.168.100.1"],
};

export default nextConfig;
