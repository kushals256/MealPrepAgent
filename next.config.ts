import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // msedge-tts uses `ws`, whose optional native deps break when bundled
  serverExternalPackages: ["msedge-tts", "ws"],
};

export default nextConfig;
