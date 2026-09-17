import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: "standalone",
  transpilePackages: ["pixi-live2d-display"],
};

export default nextConfig;
