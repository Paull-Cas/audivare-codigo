import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/contador/', '/superadmin/'],
    },
    sitemap: 'https://audivare.com/sitemap.xml',
  };
}
