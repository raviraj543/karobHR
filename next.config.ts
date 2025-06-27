const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    swSrc: 'public/firebase-messaging-sw.js',
    customWorkerDir: 'public',
});

const nextConfig = {
  reactStrictMode: true,
  compiler: {
    // ssr and displayName are configured by default
    styledComponents: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // REMOVED: output: 'export', // This line is removed for SSR/Cloud Functions deployment
};

module.exports = withPWA(nextConfig);
