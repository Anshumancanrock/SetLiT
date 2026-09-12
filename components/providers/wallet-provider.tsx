'use client'

import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  SolanaMobileWalletAdapter,
  createDefaultAuthorizationResultCache,
  createDefaultAddressSelector,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile'
import '@solana/wallet-adapter-react-ui/styles.css'
import { UnsafeBurnerWalletAdapter } from '@solana/wallet-adapter-wallets'

import { SITE_URL } from '@/lib/site-url'

const isDev = process.env.NODE_ENV === 'development'

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com'
const DOMAIN = SITE_URL

export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: 'SetL iT',
          uri: typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : DOMAIN,
          icon: 'favicon.ico',
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        chain: 'mainnet-beta',
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
      ...(isDev ? [new UnsafeBurnerWalletAdapter()] : []),
    ],
    [],
  )

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
