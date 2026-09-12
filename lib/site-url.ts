/**
 * Single source of truth for this deployment's public origin.
 *
 * Set `NEXT_PUBLIC_SITE_URL` in every environment. It is inlined at build time,
 * so it has to be present when the production build runs, not only at runtime.
 * Without it the app falls back to localhost, which is obviously wrong in
 * production rather than quietly pointing somewhere else.
 *
 * Used for canonical URLs, the sitemap and robots host, wallet-adapter app
 * identity, QR captions, and the links embedded in outgoing email.
 */

const FALLBACK_ORIGIN = 'http://localhost:3000'

export function normaliseOrigin(raw: string | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null

  // Tolerate a bare host ("pay.example.com") as well as a full origin.
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`

  try {
    // Drops any path, query or trailing slash so callers can append freely.
    return new URL(withScheme).origin
  } catch {
    return null
  }
}

/** Absolute origin with no trailing slash, e.g. `https://pay.example.com`. */
export const SITE_URL = normaliseOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? FALLBACK_ORIGIN

/** Hostname only, for display, e.g. `pay.example.com`. */
export const SITE_HOST = new URL(SITE_URL).host

/** True when the origin is still the development fallback. */
export const IS_FALLBACK_ORIGIN = SITE_URL === FALLBACK_ORIGIN
