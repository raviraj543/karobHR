/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    swSrc: 'public/firebase-messaging-sw.js',
    // Disable for development
    disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  reactStrictMode: true,
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

// Cache-busting comment: Fri Jul 12 2024 20:00:00 GMT+0000 (Coordinated Universal Time) - Next PWA activated
module.exports = withPWA(nextConfig);
