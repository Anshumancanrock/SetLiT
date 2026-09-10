interface SetLiTCheckout {
  open(opts: {
    linkId: string
    metadata?: Record<string, unknown>
    onSuccess?: (txSignature: string, metadata: Record<string, unknown> | null) => void
    onClose?: (metadata: Record<string, unknown> | null) => void
  }): void
  close(): void
}

declare global {
  interface Window {
    SetLiT: SetLiTCheckout
  }
}

export {}
