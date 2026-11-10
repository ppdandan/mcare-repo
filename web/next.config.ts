import type { NextConfig } from "next";

/**
 * Next.js configuration for M-Care web dashboard.
 * transpilePackages allows us to import from the shared types package.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@m-care/shared"],
};

export default nextConfig;
