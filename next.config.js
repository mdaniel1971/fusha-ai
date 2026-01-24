/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Disable the bailout for missing Suspense with CSR
    missingSuspenseWithCSRBailout: false,
  },
  // Use standalone output mode which handles edge cases better
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
