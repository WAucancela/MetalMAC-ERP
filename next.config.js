/** @type {import('next').NextConfig} */
const nextConfig = {
  // firebase-admin sólo se usa en server components y API Routes
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },

  // Headers de seguridad adicionales (complementa vercel.json)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // Imágenes — dominios de Firebase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },
};

module.exports = nextConfig;
