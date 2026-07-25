import type { NextConfig } from "next";

const BASE_CSP_DIRECTIVES = [
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
];

const ContentSecurityPolicy = [...BASE_CSP_DIRECTIVES, "frame-ancestors 'none'"].join("; ");

// /embed is meant to be dropped into a news site's <iframe>, the opposite of
// the rest of the app which refuses to be framed at all — so it gets its own,
// deliberately permissive frame-ancestors instead of inheriting the site-wide
// deny-all.
const EmbedContentSecurityPolicy = [...BASE_CSP_DIRECTIVES, "frame-ancestors *"].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Everything except /embed — a plain regex negative lookahead so
        // X-Frame-Options: DENY never reaches the one route meant to be framed.
        source: "/:path((?!embed).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
        ],
      },
      {
        source: "/",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: EmbedContentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
