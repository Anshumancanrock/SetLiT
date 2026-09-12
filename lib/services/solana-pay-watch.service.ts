/**
 * Solana Pay confirmation checks.
 *
 * The buyer's browser polls for status, and each poll runs one bounded scan of
 * the merchant's recent signatures. The work is driven by the poll rather than by
 * a background loop started in the request that built the transaction: that loop
 * was killed the moment its response was returned, so nothing ever watched the
 * chain and every session silently timed out.
 */

import { PublicKey } from '@solana/web3.js'

import { apiLogger } from '@/lib/api/logger'
import {
  confirmSolanaPaySession,
  getSolanaPaySession,
  updateSolanaPaySession,
  type SolanaPaySession,
  type SolanaPaySessionStatus,
} from '@/lib/realtime/solana-pay-session-store'
import { processSubmitTx } from '@/lib/services/payment-submit.service'
import { createServerConnection } from '@/lib/solana/connection'

/** How many of the merchant's recent signatures to scan on each poll. */
const SIGNATURE_SCAN_LIMIT = 15

export interface SolanaPayStatusResult {
  status: SolanaPaySessionStatus | 'not_found'
  txSignature: string | null
}

/**
 * Advance a session by one polling step and return its current status.
 *
 * Safe to call concurrently: the confirmation write is guarded, and the payment
 * record is keyed on the transaction signature, so overlapping polls converge on
 * the same result instead of recording the payment twice.
 */
export async function checkSolanaPaySession(sessionId: string): Promise<SolanaPayStatusResult> {
  const session = await getSolanaPaySession(sessionId)
  if (!session) return { status: 'not_found', txSignature: null }

  // Already settled one way or the other, so there is nothing left to scan.
  if (session.status !== 'watching') {
    return { status: session.status, txSignature: session.txSignature }
  }

  if (Date.now() >= session.expiresAt.getTime()) {
    await updateSolanaPaySession(sessionId, { status: 'timeout' })
    return { status: 'timeout', txSignature: null }
  }

  const txSignature = await findSettlingTransaction(session)
  await updateSolanaPaySession(sessionId, { lastCheckedAt: new Date() })

  if (!txSignature) return { status: 'watching', txSignature: null }

  await confirmSolanaPaySession(sessionId, txSignature)
  return { status: 'confirmed', txSignature }
}

/**
 * Scan the merchant's recent signatures for a transaction that settles this
 * session, recording the payment if one is found. Returns the signature, or null
 * when nothing matched yet.
 */
async function findSettlingTransaction(session: SolanaPaySession): Promise<string | null> {
  const connection = createServerConnection()
  const merchantPk = new PublicKey(session.merchantWallet)
  const openedAtMs = session.createdAt.getTime()

  try {
    const sigs = await connection.getSignaturesForAddress(merchantPk, { limit: SIGNATURE_SCAN_LIMIT })

    for (const sigInfo of sigs) {
      if (sigInfo.err) continue
      if ((sigInfo.blockTime ?? 0) * 1_000 < openedAtMs) continue

      const tx = await connection.getTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      })
      if (!tx) continue

      const accountKeys = tx.transaction.message.staticAccountKeys ?? []
      const involvesBuyer = accountKeys.some((k) => k.toBase58() === session.buyerWallet)
      if (!involvesBuyer) continue

      const result = await processSubmitTx({
        // Derived from the signature rather than random, so two polls that spot
        // the same transaction upsert one PaymentExecution instead of colliding
        // on its unique txSignature.
        executionId: `solana-pay:${sigInfo.signature}`,
        source: 'payment_link',
        txSignature: sigInfo.signature,
        linkId: session.linkId,
        userWallet: session.buyerWallet,
        inputToken: session.inputMint,
        inputAmount: session.inAmount,
        outputAmount: session.outAmount,
      })

      if (result.ok) return sigInfo.signature
      // Verification failed — unrelated transfer to the same merchant, keep scanning.
    }
  } catch (e) {
    // Transient RPC failure; the next poll picks up where this one left off.
    apiLogger.warn('Solana Pay confirmation scan failed', { sessionId: session.sessionId, error: String(e) })
  }

  return null
}
