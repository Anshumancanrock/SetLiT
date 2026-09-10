import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SetL iT',
    short_name: 'SetL iT',
    description: 'Accept any token. Receive USDC. Non-custodial Solana payments platform.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#432dd7',
    icons: [
      { src: '/logo.png', sizes: '192x192', type: 'image/png' },
      { src: '/setlit-logo.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
