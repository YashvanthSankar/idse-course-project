import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // /model calls its API through this site, so a visitor only needs to reach Vercel: some mobile
  // networks (measured on Jio) lose about a third of direct connections to the VPS.
  async rewrites() {
    return [{ source: "/model-api/:path*", destination: `${API_URL}/api/model/:path*` }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
