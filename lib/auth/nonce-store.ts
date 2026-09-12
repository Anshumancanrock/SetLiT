/**
 * Database-backed nonce store with a 5-minute TTL.
 *
 * Each nonce is issued once and consumed once — replaying a nonce is rejected.
 *
 * Nonces live in Postgres rather than process memory because the instance that
 * serves `GET /api/auth/nonce` is frequently not the instance that serves the
 * following `POST /api/auth/login`. Consumption is a single conditional DELETE,
 * so two concurrent logins racing on the same nonce can never both succeed.
 */

import { prisma } from '@/lib/db'

const NONCE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Chance of sweeping expired rows on any given issue, keeping the table small. */
const SWEEP_PROBABILITY = 0.02

/**
 * Issue a fresh nonce and register it in the store.
 * Returns the nonce string that must be sent to the client.
 */
export async function issueNonce(): Promise<string> {
  const nonce = crypto.randomUUID()

  await prisma.authNonce.create({
    data: { value: nonce, expiresAt: new Date(Date.now() + NONCE_TTL_MS) },
  })

  if (Math.random() < SWEEP_PROBABILITY) {
    // Best-effort cleanup; a failed sweep must never fail the request.
    void prisma.authNonce.deleteMany({ where: { expiresAt: { lte: new Date() } } }).catch(() => {})
  }

  return nonce
}

/**
 * Consume a nonce.
 * Returns `true` if the nonce existed and had not expired, `false` otherwise.
 * A nonce can only be consumed once.
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  // The expiry check lives in the WHERE clause so the lookup and the delete are
  // one atomic statement. An expired row simply fails to match and is swept later.
  const { count } = await prisma.authNonce.deleteMany({
    where: { value: nonce, expiresAt: { gt: new Date() } },
  })

  return count === 1
}
