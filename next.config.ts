import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactCompiler: true,
  serverExternalPackages: [
    "@coral-xyz/anchor",
    "@project-serum/anchor",
    "@solana/web3.js",
    "@solana/spl-token",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
