import { type NextRequest, NextResponse } from 'next/server'

import { checkSolanaPaySession } from '@/lib/services/solana-pay-watch.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/links/[id]/payment-status?session=<sessionId>
 *
 * Polled by the SolanaQRModal every 2 seconds. Each call advances the session by
 * one on-chain check and returns the result, so the poll itself is what watches
 * for settlement.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session')

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session param' }, { status: 400 })
  }

  const { status, txSignature } = await checkSolanaPaySession(sessionId)

  return NextResponse.json({ status, txSignature })
}
