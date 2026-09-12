import { describe, expect, test } from 'bun:test'

import { Decimal } from '@/lib/generated/prisma/internal/prismaNamespace'
import { decimalToBigIntUSDC, humanToRawAmount, rawToHumanAmount, toRawUsdc } from '@/lib/solana/amount'

describe('humanToRawAmount', () => {
  test('scales by the mint decimals', () => {
    expect(humanToRawAmount(new Decimal('1'), 6)).toBe(1_000_000n)
    expect(humanToRawAmount(new Decimal('47.82'), 6)).toBe(47_820_000n)
    expect(humanToRawAmount(new Decimal('2.3'), 9)).toBe(2_300_000_000n)
  })

  test('handles zero and very small amounts', () => {
    expect(humanToRawAmount(new Decimal('0'), 6)).toBe(0n)
    expect(humanToRawAmount(new Decimal('0.000001'), 6)).toBe(1n)
  })

  test('floors sub-unit precision rather than rounding up', () => {
    // A merchant must never be credited more than the buyer actually sent.
    expect(humanToRawAmount(new Decimal('0.0000019'), 6)).toBe(1n)
    expect(humanToRawAmount(new Decimal('1.9999999'), 6)).toBe(1_999_999n)
  })

  test('stays exact on values that would lose precision as a float', () => {
    expect(humanToRawAmount(new Decimal('0.1'), 6)).toBe(100_000n)
    expect(humanToRawAmount(new Decimal('1234567.891234'), 6)).toBe(1_234_567_891_234n)
  })
})

describe('decimalToBigIntUSDC', () => {
  test('treats USDC as six decimals', () => {
    expect(decimalToBigIntUSDC(new Decimal('1'))).toBe(1_000_000n)
    expect(decimalToBigIntUSDC(new Decimal('0.5'))).toBe(500_000n)
    expect(decimalToBigIntUSDC(new Decimal('12.34'))).toBe(12_340_000n)
  })
})

describe('rawToHumanAmount', () => {
  test('caps display precision at four decimal places', () => {
    expect(rawToHumanAmount(1_000_000n, 6)).toBe('1.0000')
    expect(rawToHumanAmount(47_820_000n, 6)).toBe('47.8200')
  })

  test('uses the mint decimals when there are four or fewer', () => {
    expect(rawToHumanAmount(150n, 2)).toBe('1.50')
    expect(rawToHumanAmount(0n, 2)).toBe('0.00')
  })
})

describe('toRawUsdc', () => {
  test('converts decimal strings to raw units', () => {
    expect(toRawUsdc('1')).toBe(1_000_000n)
    expect(toRawUsdc('0.000001')).toBe(1n)
    expect(toRawUsdc('99.99')).toBe(99_990_000n)
  })

  test('survives values that are not exactly representable as floats', () => {
    // 0.1 and 0.07 both have repeating binary expansions; rounding is what keeps
    // this honest, and the test exists so a switch to truncation gets caught.
    expect(toRawUsdc('0.1')).toBe(100_000n)
    expect(toRawUsdc('0.07')).toBe(70_000n)
    expect(toRawUsdc('1.005')).toBe(1_005_000n)
  })
})
