/** @type {import('next').NextConfig} */
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Semua request /api/* diteruskan (proxy) ke backend Express.
  // Browser hanya bicara dengan domain frontend, sehingga cookie login aman (first-party)
  // dan tidak perlu pengaturan CORS.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
