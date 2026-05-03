import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "animenew.com.br" },
      { protocol: "https", hostname: "www.animenew.com.br" },
      { protocol: "https", hostname: "animenewsnetwork.com" },
      { protocol: "https", hostname: "www.animenewsnetwork.com" },
      { protocol: "https", hostname: "cdn.animenewsnetwork.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 604800,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
