/**
 * Integration tests that need a real Postgres.
 *
 * Skipped unless DATABASE_URL is set, so `bun test` stays green without one.
 *
 * Note that `bun test` runs with NODE_ENV=test, and .env.local is deliberately
 * not loaded in test environments, so pointing .env.local at a database is not
 * enough. Pass the URL explicitly or put it in .env.test:
 *
 *   docker run -d --name setlit-db -e POSTGRES_PASSWORD=pw -e POSTGRES_USER=u \
 *     -e POSTGRES_DB=setlit -p 5432:5432 postgres:16-alpine
 *   bun run db:push                      # uses .env.local
 *   DATABASE_URL=postgresql://u:pw@localhost:5432/setlit bun test
 *
 * These cover the behaviour that unit tests cannot reach: that auth nonces and
 * Solana Pay sessions are visible across instances and safe under the concurrent
 * access a serverless deployment produces.
 */
import { afterAll, describe, expect, test } from 'bun:test'

import { consumeNonce, issueNonce } from '@/lib/auth/nonce-store'
import { prisma } from '@/lib/db'
import {
  confirmSolanaPaySession,
  createSolanaPaySession,
  getSolanaPaySession,
  updateSolanaPaySession,
} from '@/lib/realtime/solana-pay-session-store'

const hasDatabase = Boolean(process.env.DATABASE_URL)
const describeDb = hasDatabase ? describe : describe.skip

afterAll(async () => {
  if (hasDatabase) await prisma.$disconnect()
})

describeDb('auth nonce store', () => {
  test('accepts a freshly issued nonce exactly once', async () => {
    const nonce = await issueNonce()

    expect(await consumeNonce(nonce)).toBe(true)
    // Replaying the same nonce is the attack this store exists to stop.
    expect(await consumeNonce(nonce)).toBe(false)
  })

  test('deletes the row once consumed', async () => {
    const nonce = await issueNonce()
    await consumeNonce(nonce)

    expect(await prisma.authNonce.count({ where: { value: nonce } })).toBe(0)
  })

  test('rejects a nonce that was never issued', async () => {
    expect(await consumeNonce(`never-issued-${crypto.randomUUID()}`)).toBe(false)
  })

  test('rejects an expired nonce', async () => {
    const value = `expired-${crypto.randomUUID()}`
    await prisma.authNonce.create({ data: { value, expiresAt: new Date(Date.now() - 1_000) } })

    expect(await consumeNonce(value)).toBe(false)

    await prisma.authNonce.deleteMany({ where: { value } })
  })

  test('lets exactly one caller win when many redeem at once', async () => {
    // Several instances can process a retried login simultaneously. If more than
    // one wins, a captured nonce becomes replayable.
    const nonce = await issueNonce()
    const results = await Promise.all(Array.from({ length: 12 }, () => consumeNonce(nonce)))

    expect(results.filter(Boolean)).toHaveLength(1)
  })

  test('is visible to a separate connection, not just the issuing process', async () => {
    const nonce = await issueNonce()

    const { PrismaClient } = await import('@/lib/generated/prisma/client')
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const other = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

    try {
      // The in-memory Map this replaced returned undefined here, which is why
      // login failed intermittently on serverless.
      expect(await other.authNonce.findUnique({ where: { value: nonce } })).not.toBeNull()
    } finally {
      await other.$disconnect()
      await prisma.authNonce.deleteMany({ where: { value: nonce } })
    }
  })
})

describeDb('solana pay session store', () => {
  async function openSession() {
    const sessionId = `sess_${crypto.randomUUID()}`
    await createSolanaPaySession({
      sessionId,
      linkId: `lnk_${crypto.randomUUID()}`,
      merchantWallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      buyerWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inAmount: '2300000000',
      outAmount: '47820000',
      requestId: null,
      isDirect: false,
    })
    return sessionId
  }

  test('round-trips a session and starts it watching', async () => {
    const sessionId = await openSession()
    const session = await getSolanaPaySession(sessionId)

    expect(session).not.toBeNull()
    expect(session?.status).toBe('watching')
    expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now())

    // Raw amounts are strings because they exceed what a JS number holds exactly.
    expect(session?.inAmount).toBe('2300000000')

    await prisma.solanaPaySession.deleteMany({ where: { sessionId } })
  })

  test('lets exactly one poll record the confirmation', async () => {
    const sessionId = await openSession()

    // Overlapping polls can all observe the same settling transaction.
    const results = await Promise.all([
      confirmSolanaPaySession(sessionId, 'sig_first'),
      confirmSolanaPaySession(sessionId, 'sig_second'),
      confirmSolanaPaySession(sessionId, 'sig_third'),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)
    expect((await getSolanaPaySession(sessionId))?.status).toBe('confirmed')

    await prisma.solanaPaySession.deleteMany({ where: { sessionId } })
  })

  test('does not throw when updating a session that was already swept', async () => {
    // A poll can land after the expiry sweep removed the row.
    await updateSolanaPaySession(`gone-${crypto.randomUUID()}`, { status: 'timeout' })
  })

  test('returns null for an unknown session', async () => {
    expect(await getSolanaPaySession(`missing-${crypto.randomUUID()}`)).toBeNull()
  })
})
