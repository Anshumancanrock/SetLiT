import { z } from 'zod'

export const paymentLinkId = z.string().cuid()

export const splitRecipientInput = z.object({
  wallet: z.string().min(32).max(64),
  /** Integer basis points out of 10000 — e.g. 7000 = 70 % */
  basisPoints: z.number().int().min(1).max(9999),
})

/** Basis points across all split recipients must add up to exactly this. */
export const TOTAL_BASIS_POINTS = 10_000

/**
 * Sum of basis points across a split.
 *
 * Kept separate from the Zod schema because the rule spans the whole array while
 * `splitRecipientInput` only sees one entry at a time.
 */
export function sumBasisPoints(recipients: readonly { basisPoints: number }[]): number {
  return recipients.reduce((sum, r) => sum + r.basisPoints, 0)
}

/** True when a split allocates the payment exactly once, with no shortfall or overflow. */
export function isValidSplit(recipients: readonly { basisPoints: number }[]): boolean {
  return sumBasisPoints(recipients) === TOTAL_BASIS_POINTS
}

export const createLinkBody = z.object({
  token: z.string().min(32).max(64),
  amount: z.union([z.number().positive(), z.string()]),
  title: z.string().min(1, 'Title is required').max(30),
  description: z.string().max(100).optional(),
  /**
   * Optional split config — up to 10 recipients (including the merchant).
   * basisPoints across all entries must sum to exactly 10000.
   * If omitted the merchant wallet receives 100% of every payment.
   */
  recipients: z.array(splitRecipientInput).min(1).max(10).optional(),
  /** YYYY-MM-DD date string — link stops accepting payments after end of this day (UTC). */
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expiresAt must be YYYY-MM-DD')
    .optional(),
  /** Maximum number of successful payments the link will accept. */
  maxUses: z.number().int().min(1).max(100_000).optional(),
})

export const updateLinkActiveBody = z.object({
  active: z.boolean(),
})

export type SplitRecipientInput = z.infer<typeof splitRecipientInput>
export type SplitRecipientInputArr = z.infer<typeof createLinkBody>['recipients']
export type CreateLinkBody = z.infer<typeof createLinkBody>
export type UpdateLinkActiveBody = z.infer<typeof updateLinkActiveBody>
