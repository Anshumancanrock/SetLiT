import type { Metadata } from 'next'
import { Geist_Mono, Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'
import { FloatingThemeToggle } from '@/components/shared/floating-theme-toggle'
import { Providers } from './providers'
import { Analytics } from '@vercel/analytics/next'
import { SITE_URL } from '@/lib/site-url'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const fontMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: 'SetL iT — Accept Any Token. Receive USDC.',
    template: '%s | SetL iT',
  },

  description:
    'SetL iT is a non-custodial Solana payments platform. Accept SOL, BONK, or any SPL token — your buyers pay in any token, you receive USDC instantly. Create payment links, invoices, subscriptions, and embed a one-line checkout on any site.',

  keywords: [
    'Solana payments',
    'crypto payment links',
    'accept crypto payments',
    'non-custodial crypto payments',
    'USDC settlement',
    'accept any token Solana',
    'Solana payment gateway',
    'crypto invoicing',
    'crypto subscriptions',
    'Solana checkout',
    'SPL token payments',
    'Jupiter swap payments',
    'Solana payment API',
    'BONK payments USDC',
    'SOL payments USDC',
    'crypto payment platform',
    'headless crypto payments',
    'embeddable crypto checkout',
  ],

  authors: [{ name: 'Anshuman', url: 'https://x.com/0xAnshuman' }],
  creator: 'Anshuman',
  publisher: 'SetL iT',
  category: 'Finance',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'SetL iT',
    title: 'SetL iT — Accept Any Token. Receive USDC.',
    description:
      'Non-custodial Solana payments. Create payment links, invoices, subscriptions, and embed a checkout — your buyers pay in any token, you receive USDC instantly.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'SetL iT — Accept any token. Receive USDC.' }],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'SetL iT — Accept Any Token. Receive USDC.',
    description:
      'Non-custodial Solana payments. Accept SOL, BONK, or any SPL token. You receive USDC instantly. Payment links, invoices, subscriptions, checkout.',
    images: ['/opengraph-image'],
    creator: '@0xAnshuman',
    site: '@0xAnshuman',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },

  alternates: {
    canonical: SITE_URL,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
      className={cn('h-full antialiased', fontMono.variable, inter.variable, 'font-sans')}
    >
      <body className='flex min-h-full flex-col bg-background text-foreground no-scrollbar overflow-x-hidden'>
        <ThemeProvider attribute='class' defaultTheme='light' enableSystem disableTransitionOnChange>
          <Providers>
            <FloatingThemeToggle />
            <div className='flex min-h-screen flex-col bg-background'>{children}</div>
            <Toaster richColors position='bottom-right' />
          </Providers>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
