import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
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
