/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Temporarily removed or commented out for debugging build speed:
  // compiler: {
  //   styledComponents: true,
  // },
  typescript: {
    ignoreBuildErrors: true,
  },
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
  // images: {
  //   remotePatterns: [
  //     {
  //       protocol: 'https',
  //       hostname: 'placehold.co',
  //       port: '',
  //       pathname: '/**', 
  //     },
  //   ],
  // },
  experimental: {
    // allowedDevOrigins removed for production deployment
  },
};

// Temporarily removed withPWA for debugging build speed
// const withPWA = require('next-pwa')({
//     dest: 'public',
//     register: true,
//     skipWaiting: true,
//     swSrc: 'public/firebase-messaging-sw.js',
//     customWorkerDir: 'public',
// });
// module.exports = withPWA(nextConfig);

module.exports = nextConfig;
