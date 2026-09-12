/**
 * Database-backed Solana Pay session store.
 *
 * A session is written by the instance that builds the transaction for the
 * wallet, then read by whichever instance serves the buyer's status polls. Those
 * are rarely the same instance, so the registry cannot live in process memory.
 *
 * Sessions are short-lived: `expiresAt` is the point after which the payment is
 * considered timed out, and expired rows are swept opportunistically.
 */

import { prisma } from '@/lib/db'

export type SolanaPaySessionStatus = 'watching' | 'confirmed' | 'timeout'

/** How long a session stays open before it is reported as timed out. */
export const SESSION_TTL_MS = 3 * 60 * 1000 // 3 minutes

/** Chance of sweeping expired rows on any given create. */
const SWEEP_PROBABILITY = 0.05

export interface SolanaPaySession {
  sessionId: string
  linkId: string
  merchantWallet: string
  buyerWallet: string
  inputMint: string
  outputMint: string
  /** Raw amount string from Jupiter (e.g. "2300000000" for 2.3 SOL). */
  inAmount: string
  /** Raw amount string from Jupiter (e.g. "47820000" for 47.82 USDC). */
  outAmount: string
  requestId: string | null
  isDirect: boolean
  createdAt: Date
  expiresAt: Date
  /** When a poll last ran an on-chain check for this session. */
  lastCheckedAt: Date | null
  status: SolanaPaySessionStatus
  txSignature: string | null
}

export type NewSolanaPaySession = Omit<SolanaPaySession, 'createdAt' | 'expiresAt' | 'lastCheckedAt' | 'status' | 'txSignature'>

export async function createSolanaPaySession(session: NewSolanaPaySession): Promise<SolanaPaySession> {
  const created = await prisma.solanaPaySession.create({
    data: { ...session, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  })

  if (Math.random() < SWEEP_PROBABILITY) {
    // Best-effort cleanup; a failed sweep must never fail the request.
    void prisma.solanaPaySession.deleteMany({ where: { expiresAt: { lte: new Date() } } }).catch(() => {})
  }

  return created
}

export async function getSolanaPaySession(sessionId: string): Promise<SolanaPaySession | null> {
  return prisma.solanaPaySession.findUnique({ where: { sessionId } })
}

export async function updateSolanaPaySession(
  sessionId: string,
  update: Partial<Pick<SolanaPaySession, 'status' | 'txSignature' | 'lastCheckedAt'>>,
): Promise<void> {
  // updateMany rather than update so a session swept between read and write
  // does not throw a P2025 on a code path the caller cannot usefully recover from.
  await prisma.solanaPaySession.updateMany({ where: { sessionId }, data: update })
}

/**
 * Mark a session confirmed, but only if it is still watching.
 *
 * Concurrent polls can observe the same on-chain transaction, so the guard keeps
 * the first writer's signature rather than letting a later poll overwrite it.
 * Returns true if this caller was the one that recorded the confirmation.
 */
export async function confirmSolanaPaySession(sessionId: string, txSignature: string): Promise<boolean> {
  const { count } = await prisma.solanaPaySession.updateMany({
    where: { sessionId, status: 'watching' },
    data: { status: 'confirmed', txSignature },
  })

  return count === 1
}
