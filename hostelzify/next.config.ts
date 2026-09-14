import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
    resolveAlias: {
      "@hostelzify/api-client": path.resolve(process.cwd(), "../packages/api-client/src/index.ts"),
    },
  },
  async redirects() {
    return [
      {
        source: '/signup',
        destination: '/register',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
