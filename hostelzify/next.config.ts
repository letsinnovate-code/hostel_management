import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@hostelzify/api-client"],
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
    resolveAlias: {
      "@hostelzify/api-client": path.resolve(process.cwd(), "../packages/api-client/src/index.ts"),
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      axios: path.resolve(process.cwd(), "node_modules", "axios"),
    };
    return config;
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
