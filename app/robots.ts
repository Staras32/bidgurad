import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/new-project', '/privacy', '/terms'],
      disallow: ['/auth', '/auth/', '/projects', '/projects/', '/supplier-quotes', '/supplier-quotes/', '/api/'],
    },
    sitemap: 'https://www.bidguard.eu/sitemap.xml',
    host: 'https://www.bidguard.eu',
  };
}
