import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/docs', '/pay/', '/subscribe/', '/invoice/'],
        disallow: ['/dashboard/', '/api/', '/embed/', '/manage/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
