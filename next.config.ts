import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  transpilePackages: ['@solana/web3.js', '@solana/spl-token'],
  serverExternalPackages: ['@coral-xyz/anchor'],
};


export default nextConfig;
