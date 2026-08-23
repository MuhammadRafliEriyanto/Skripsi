import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/register-online/:path*",
        destination: "/register/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
