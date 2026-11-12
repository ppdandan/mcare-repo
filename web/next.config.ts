import type { NextConfig } from "next";

/**
 * Next.js configuration for M-Care web dashboard.
 * transpilePackages allows us to import from the shared types package.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@m-care/shared"],
  async redirects() {
    return ["/book", "/appointments", "/transactions", "/profile"].map((source) => ({
      source,
      destination: "/patient-app",
      permanent: false,
    }));
  },
};

export default nextConfig;
