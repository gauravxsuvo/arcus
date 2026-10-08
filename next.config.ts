import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.ARCUS_DIST_DIR || ".next",
};

export default nextConfig;
