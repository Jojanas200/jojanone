import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Node-only drivers (postgres, the ioredis TCP cache client) external
  // rather than bundled into the server output.
  serverExternalPackages: ["postgres", "ioredis"],
  eslint: {
    // Lint runs as a separate step (`npm run lint`). During the TanStack→Next
    // migration the repo also contains dormant TanStack files with their own
    // style, so we don't gate the production build on ESLint. Type errors still
    // fail the build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
