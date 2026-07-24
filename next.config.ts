import type { NextConfig } from "next";

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js requires 'unsafe-inline' for its runtime scripts; 'unsafe-eval'
  // is used by MapLibre GL's shader compilation.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Carto streets basemap + tiles; ESRI satellite tiles; NASA GIBS true-color
  // imagery; EUMETSAT WMS fire overlays.
  "connect-src 'self' https://basemaps.cartocdn.com https://*.cartocdn.com https://server.arcgisonline.com https://gibs.earthdata.nasa.gov https://view.eumetsat.int",
  // MapLibre GL creates web workers from blob: URLs.
  "worker-src blob:",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
