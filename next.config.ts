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
    allowedDevOrigins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://10.88.0.3:3000',
      'http://10.88.0.3:3001',
      'https://3000-firebase-studio-1748594124367.cluster-xpmcxs2fjnhg6xvn446ubtgpio.cloudworkstations.dev',
      'https://3001-firebase-studio-1748594124367.cluster-xpmcxs2fjnhg6xvn446ubtgpio.cloudworkstations.dev',
      'https://9000-firebase-studio-1748594124367.cluster-xpmcxs2fjnhg6xvn446ubtgpio.cloudworkstations.dev',
    ],
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
