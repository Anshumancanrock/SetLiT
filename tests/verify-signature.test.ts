import { describe, expect, test } from 'bun:test'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import nacl from 'tweetnacl'

import { verifyWalletSignature } from '@/lib/auth/verify-signature'

/** Sign a message the same way a wallet does, returning base64 as the API expects. */
function sign(keypair: Keypair, message: string): string {
  const signature = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey)
  return Buffer.from(signature).toString('base64')
}

const MESSAGE = 'Sign in to SetL iT:\n0f8c9e1a-4b2d-4f6e-9a3c-1d5e7f9b2c4a'

describe('verifyWalletSignature', () => {
  test('accepts a signature produced by the claimed wallet', () => {
    const keypair = Keypair.generate()
    const wallet = keypair.publicKey.toBase58()

    expect(verifyWalletSignature(wallet, MESSAGE, sign(keypair, MESSAGE))).toBe(true)
  })

  test('rejects a signature from a different wallet', () => {
    const signer = Keypair.generate()
    const impostor = Keypair.generate()

    // The signature is valid, just not for the wallet being claimed.
    const signature = sign(signer, MESSAGE)

    expect(verifyWalletSignature(impostor.publicKey.toBase58(), MESSAGE, signature)).toBe(false)
  })

  test('rejects a signature over a different message', () => {
    const keypair = Keypair.generate()
    const signature = sign(keypair, MESSAGE)

    // Replaying a signature against another nonce must not authenticate.
    const otherMessage = 'Sign in to SetL iT:\nffffffff-0000-4000-8000-000000000000'

    expect(verifyWalletSignature(keypair.publicKey.toBase58(), otherMessage, signature)).toBe(false)
  })

  test('rejects a tampered signature', () => {
    const keypair = Keypair.generate()
    const raw = Buffer.from(sign(keypair, MESSAGE), 'base64')
    raw[0] ^= 0xff

    expect(verifyWalletSignature(keypair.publicKey.toBase58(), MESSAGE, raw.toString('base64'))).toBe(false)
  })

  test('returns false rather than throwing on malformed input', () => {
    const keypair = Keypair.generate()
    const wallet = keypair.publicKey.toBase58()

    // Every one of these reaches the endpoint as unvalidated request data.
    expect(verifyWalletSignature(wallet, MESSAGE, 'not-base64!!')).toBe(false)
    expect(verifyWalletSignature(wallet, MESSAGE, '')).toBe(false)
    expect(verifyWalletSignature('not-a-wallet', MESSAGE, sign(keypair, MESSAGE))).toBe(false)
    expect(verifyWalletSignature(bs58.encode(Buffer.alloc(10)), MESSAGE, sign(keypair, MESSAGE))).toBe(false)
  })
})
