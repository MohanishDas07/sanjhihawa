/** @type {import('next').NextConfig} */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com http://localhost:8000 http://127.0.0.1:8000;
  frame-ancestors 'none';
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: cspHeader },
        { key: "X-DNS-Prefetch-Control", value: "on" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      ],
    },
  ],
};

export default nextConfig;
