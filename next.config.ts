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
