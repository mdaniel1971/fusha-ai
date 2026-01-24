/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Disable the bailout for missing Suspense with CSR
    missingSuspenseWithCSRBailout: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
