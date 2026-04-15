import type { NextConfig } from "next";

const backendApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        destination: `${backendApiBaseUrl}/:path*`,
        source: "/api/:path*",
      },
    ];
  },
};

export default nextConfig;
