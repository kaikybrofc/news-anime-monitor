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
      { protocol: "https", hostname: "animecorner.me" },
      { protocol: "https", hostname: "www.animecorner.me" },
      { protocol: "https", hostname: "static.animecorner.me" },
      { protocol: "https", hostname: "anitrendz.net" },
      { protocol: "https", hostname: "www.anitrendz.net" },
      { protocol: "https", hostname: "myanimelist.net" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "otakuusamagazine.com" },
      { protocol: "https", hostname: "www.otakuusamagazine.com" },
      { protocol: "https", hostname: "animeherald.com" },
      { protocol: "https", hostname: "www.animeherald.com" },
      { protocol: "https", hostname: "animeuknews.net" },
      { protocol: "https", hostname: "www.animeuknews.net" },
      { protocol: "https", hostname: "otakunews.com" },
      { protocol: "https", hostname: "www.otakunews.com" },
      { protocol: "https", hostname: "siliconera.com" },
      { protocol: "https", hostname: "www.siliconera.com" },
      { protocol: "https", hostname: "crunchyroll.com" },
      { protocol: "https", hostname: "www.crunchyroll.com" },
      { protocol: "https", hostname: "imgsrv.crunchyroll.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 604800,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
