import { describe, expect, test } from 'bun:test'

import { normaliseOrigin } from '@/lib/site-url'

describe('normaliseOrigin', () => {
  test('keeps a well-formed origin as-is', () => {
    expect(normaliseOrigin('https://pay.example.com')).toBe('https://pay.example.com')
  })

  test('assumes https for a bare host', () => {
    expect(normaliseOrigin('pay.example.com')).toBe('https://pay.example.com')
  })

  test('strips a trailing slash so callers can append a path safely', () => {
    // Without this, `${SITE_URL}/sitemap.xml` would produce a double slash.
    expect(normaliseOrigin('https://pay.example.com/')).toBe('https://pay.example.com')
    expect(normaliseOrigin('https://pay.example.com///')).toBe('https://pay.example.com')
  })

  test('drops any path, query or fragment', () => {
    expect(normaliseOrigin('https://pay.example.com/checkout')).toBe('https://pay.example.com')
    expect(normaliseOrigin('https://pay.example.com/?utm=1')).toBe('https://pay.example.com')
  })

  test('preserves a non-default port', () => {
    expect(normaliseOrigin('http://localhost:3000')).toBe('http://localhost:3000')
  })

  test('keeps http when it is given explicitly', () => {
    expect(normaliseOrigin('http://pay.example.com')).toBe('http://pay.example.com')
  })

  test('trims surrounding whitespace', () => {
    expect(normaliseOrigin('  https://pay.example.com  ')).toBe('https://pay.example.com')
  })

  test('returns null for an absent or blank value', () => {
    // A blank env var is the case that `??` misses and `||` catches; the whole
    // point of this helper is that both end up on the fallback.
    expect(normaliseOrigin(undefined)).toBeNull()
    expect(normaliseOrigin('')).toBeNull()
    expect(normaliseOrigin('   ')).toBeNull()
  })

  test('returns null for a value that cannot be parsed as a URL', () => {
    expect(normaliseOrigin('http://')).toBeNull()
  })
})
