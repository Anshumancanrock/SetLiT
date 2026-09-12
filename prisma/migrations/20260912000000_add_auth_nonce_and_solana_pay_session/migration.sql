-- CreateEnum
CREATE TYPE "SolanaPayStatus" AS ENUM ('watching', 'confirmed', 'timeout');

-- CreateTable: auth nonces, shared across instances so login works on serverless
CREATE TABLE "AuthNonce" (
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("value")
);

-- CreateIndex
CREATE INDEX "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- CreateTable: Solana Pay sessions, polled by the buyer's browser
CREATE TABLE "SolanaPaySession" (
    "sessionId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "merchantWallet" TEXT NOT NULL,
    "buyerWallet" TEXT NOT NULL,
    "inputMint" TEXT NOT NULL,
    "outputMint" TEXT NOT NULL,
    "inAmount" TEXT NOT NULL,
    "outAmount" TEXT NOT NULL,
    "requestId" TEXT,
    "isDirect" BOOLEAN NOT NULL,
    "status" "SolanaPayStatus" NOT NULL DEFAULT 'watching',
    "txSignature" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolanaPaySession_pkey" PRIMARY KEY ("sessionId")
);

-- CreateIndex
CREATE INDEX "SolanaPaySession_expiresAt_idx" ON "SolanaPaySession"("expiresAt");

-- CreateIndex
CREATE INDEX "SolanaPaySession_linkId_idx" ON "SolanaPaySession"("linkId");
