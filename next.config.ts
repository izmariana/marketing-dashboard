import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "scontent.xx.fbcdn.net" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "graph.facebook.com" },
    ],
  },
};

export default nextConfig;
