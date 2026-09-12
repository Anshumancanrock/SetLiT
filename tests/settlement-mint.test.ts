import { describe, expect, test } from 'bun:test'

import { getDefaultUsdcMint, isAllowedSettlementMint, parseCluster, SOL_MINT } from '@/lib/solana/constants'

const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

describe('parseCluster', () => {
  test('recognises devnet', () => {
    expect(parseCluster('devnet')).toBe('devnet')
  })

  test('defaults to mainnet for anything else', () => {
    // An unset or misspelled env var must not silently settle on devnet.
    expect(parseCluster('mainnet-beta')).toBe('mainnet-beta')
    expect(parseCluster(undefined)).toBe('mainnet-beta')
    expect(parseCluster('')).toBe('mainnet-beta')
    expect(parseCluster('Devnet')).toBe('mainnet-beta')
    expect(parseCluster('testnet')).toBe('mainnet-beta')
  })
})

describe('getDefaultUsdcMint', () => {
  test('returns the USDC mint for each cluster', () => {
    expect(getDefaultUsdcMint('mainnet-beta')).toBe(USDC_MAINNET)
    expect(getDefaultUsdcMint('devnet')).toBe(USDC_DEVNET)
  })

  test('defaults to mainnet', () => {
    expect(getDefaultUsdcMint()).toBe(USDC_MAINNET)
  })
})

describe('isAllowedSettlementMint', () => {
  test('allows USDC on its own cluster', () => {
    expect(isAllowedSettlementMint(USDC_MAINNET, 'mainnet-beta')).toBe(true)
    expect(isAllowedSettlementMint(USDC_DEVNET, 'devnet')).toBe(true)
  })

  test('rejects the other cluster’s USDC', () => {
    // Accepting devnet USDC on mainnet would settle merchants in a worthless token.
    expect(isAllowedSettlementMint(USDC_DEVNET, 'mainnet-beta')).toBe(false)
    expect(isAllowedSettlementMint(USDC_MAINNET, 'devnet')).toBe(false)
  })

  test('rejects non-USDC mints', () => {
    expect(isAllowedSettlementMint(SOL_MINT, 'mainnet-beta')).toBe(false)
    expect(isAllowedSettlementMint('', 'mainnet-beta')).toBe(false)
  })
})
