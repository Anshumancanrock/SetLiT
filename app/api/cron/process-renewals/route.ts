import { timingSafeEqual } from 'node:crypto'

import { type NextRequest, NextResponse } from 'next/server'

import { handleApi } from '@/lib/api/errors'
import { apiLogger } from '@/lib/api/logger'
import { getCronSecret } from '@/lib/env/server'
import { processDueRenewals } from '@/lib/services/subscription-renewal.service'

/**
 * Subscription renewal cron.
 *
 * `processDueRenewals` only does work at UTC hours 22, 23 and 0, which are the
 * three retry attempts around midnight UTC, so this must be invoked at each of
 * those hours. The schedule lives in `vercel.json`.
 *
 * GET  — Vercel Cron, which sends `Authorization: Bearer <CRON_SECRET>`.
 * POST — manual or external schedulers, which send `X-Cron-Secret: <CRON_SECRET>`.
 */

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)

  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

async function runRenewals(provided: string | null) {
  let expected: string
  try {
    expected = getCronSecret()
  } catch {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }

  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  apiLogger.info('Processing subscription renewals', { utcHour: now.getUTCHours() })

  const summary = await processDueRenewals(now)
  apiLogger.info('Renewal run complete', summary)

  return NextResponse.json({ ok: true, ...summary })
}

export async function GET(req: NextRequest) {
  return handleApi(async () => {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? null
    return runRenewals(bearer)
  })
}

export async function POST(req: NextRequest) {
  return handleApi(async () => runRenewals(req.headers.get('x-cron-secret')))
}
