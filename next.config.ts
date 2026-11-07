import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  // GitHub Pages benefits from directory-style URLs, but Vercel Functions
  // must keep their canonical /api/name paths without a trailing-slash redirect.
  trailingSlash: process.env.VERCEL !== '1',
  images: { unoptimized: true }
};
export default config;
