/** @type {import('next').NextConfig} */
const nextConfig = {
  // Headers de seguridad
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

  // Imágenes — Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        // El hostname real depende de tu proyecto Supabase:
        // formato: <project-ref>.supabase.co
        hostname: '*.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
