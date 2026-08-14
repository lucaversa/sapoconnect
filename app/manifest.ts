import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SapoConnect',
    short_name: 'SapoConnect',
    description: 'Vida acadêmica em uma experiência rápida e mobile.',
    start_url: '/app/calendario',
    display: 'standalone',
    background_color: '#0c111d',
    theme_color: '#0c111d',
    orientation: 'portrait',
    lang: 'pt-BR',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/brand/sapoconnect-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/sapoconnect-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
