
const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    // Solution: Tell next-pwa exactly where to find the FCM service worker
    runtimeCaching: [], // Disable default runtime caching if not needed
    buildExcludes: [/middleware.ts$/],
    swSrc: './public/firebase-messaging-sw.js', // Specify the path to your service worker file
    customWorkerDir: 'public', // Directory where your custom service worker is
});

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
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
};

module.exports = withPWA(nextConfig);
