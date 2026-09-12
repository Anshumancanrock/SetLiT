import { describe, expect, test } from 'bun:test'

import { isValidSplit, splitRecipientInput, sumBasisPoints, TOTAL_BASIS_POINTS } from '@/lib/validation'

const wallet = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'

describe('sumBasisPoints', () => {
  test('adds every recipient share', () => {
    expect(sumBasisPoints([{ basisPoints: 7000 }, { basisPoints: 3000 }])).toBe(10_000)
    expect(sumBasisPoints([])).toBe(0)
  })
})

describe('isValidSplit', () => {
  test('accepts a split that allocates the payment exactly once', () => {
    expect(isValidSplit([{ basisPoints: 10_000 }])).toBe(true)
    expect(isValidSplit([{ basisPoints: 7000 }, { basisPoints: 3000 }])).toBe(true)
    expect(isValidSplit([{ basisPoints: 3334 }, { basisPoints: 3333 }, { basisPoints: 3333 }])).toBe(true)
  })

  test('rejects a shortfall, which would strand funds', () => {
    expect(isValidSplit([{ basisPoints: 7000 }, { basisPoints: 2000 }])).toBe(false)
  })

  test('rejects an overflow, which would over-allocate the payment', () => {
    expect(isValidSplit([{ basisPoints: 7000 }, { basisPoints: 4000 }])).toBe(false)
  })

  test('rejects an empty split', () => {
    expect(isValidSplit([])).toBe(false)
  })

  test('TOTAL_BASIS_POINTS matches the divisor used when distributing', () => {
    // distribute.service.ts computes owed = outputRaw * basisPoints / 10000.
    expect(TOTAL_BASIS_POINTS).toBe(10_000)
  })
})

describe('splitRecipientInput', () => {
  test('accepts a well-formed recipient', () => {
    expect(splitRecipientInput.safeParse({ wallet, basisPoints: 5000 }).success).toBe(true)
  })

  test('rejects a zero or negative share', () => {
    expect(splitRecipientInput.safeParse({ wallet, basisPoints: 0 }).success).toBe(false)
    expect(splitRecipientInput.safeParse({ wallet, basisPoints: -1 }).success).toBe(false)
  })

  test('rejects a single recipient taking the entire payment', () => {
    // A 10000 entry would make the split pointless, so the schema caps one entry
    // at 9999 and relies on isValidSplit for the total.
    expect(splitRecipientInput.safeParse({ wallet, basisPoints: 10_000 }).success).toBe(false)
  })

  test('rejects fractional basis points', () => {
    expect(splitRecipientInput.safeParse({ wallet, basisPoints: 50.5 }).success).toBe(false)
  })
})
