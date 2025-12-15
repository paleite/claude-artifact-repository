import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  reactStrictMode: true,

  output: "export",
};

export default nextConfig;
