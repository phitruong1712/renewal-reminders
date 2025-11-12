/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Disable ESLint during builds to avoid deprecated options error
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore TypeScript errors during builds (optional, remove if you want strict type checking)
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

