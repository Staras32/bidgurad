import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BidGuard',
    short_name: 'BidGuard',
    description: 'Statybos sąmatų ir tiekėjų pasiūlymų valdymas.',
    start_url: '/new-project',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#4f46e5',
    lang: 'lt',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
