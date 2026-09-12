import { type NextRequest, NextResponse } from 'next/server'

import { handleApi } from '@/lib/api/errors'
import { paymentLinkId } from '@/lib/validation'
import { getPaymentLinkByDetails } from '@/lib/solana/database-lookup'
import { executeJupiterOrderRequest } from '@/lib/services/jupiter-order.service'
import { createSolanaPaySession } from '@/lib/realtime/solana-pay-session-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

type Params = { params: Promise<{ id: string; mint: string; session: string }> }

/** OPTIONS — CORS preflight required by SolanaPay. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

/**
 * GET — SolanaPay fetches label + icon before showing the payment screen.
 * inputMint and sessionId come from path params so they survive SolanaPay's POST.
 */
export async function GET(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const { id } = await params
    if (!paymentLinkId.safeParse(id).success) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS })
    }

    await getPaymentLinkByDetails(id)

    const origin = req.nextUrl.origin
    return NextResponse.json({ label: 'SetL iT Payment', icon: `${origin}/logo.png` }, { headers: CORS })
  })
}

/**
 * POST — SolanaPay sends { account: "<buyer_wallet>" }.
 * We build the Jupiter swap tx and return it unsigned for SolanaPay to sign + broadcast.
 * inputMint and sessionId are in path params (SolanaPay strips query params on POST).
 */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const { id, mint: inputMint, session: sessionId } = await params

    if (!paymentLinkId.safeParse(id).success) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS })
    }

    const body = await req.json().catch(() => ({}))
    const buyerWallet: string | undefined = body?.account
    if (!buyerWallet) {
      return NextResponse.json({ error: 'Missing account in request body' }, { status: 400, headers: CORS })
    }

    const link = await getPaymentLinkByDetails(id)

    const order = await executeJupiterOrderRequest({
      inputMint,
      taker: buyerWallet,
      payId: id,
    })

    if (!order.transaction) {
      return NextResponse.json({ error: 'Failed to build transaction' }, { status: 500, headers: CORS })
    }

    // Confirmation is driven by the buyer's status polls, so the session only
    // has to outlive this request.
    await createSolanaPaySession({
      sessionId,
      linkId: id,
      merchantWallet: link.merchant.wallet,
      buyerWallet,
      inputMint,
      outputMint: order.outputMint,
      inAmount: order.inAmount,
      outAmount: order.outAmount,
      requestId: order.requestId,
      isDirect: order.isDirect,
    })

    return NextResponse.json({ transaction: order.transaction }, { headers: CORS })
  })
}
