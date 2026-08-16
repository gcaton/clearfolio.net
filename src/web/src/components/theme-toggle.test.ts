import { describe, it, expect } from 'vitest'
import { isTheme } from './theme-toggle'

describe('isTheme', () => {
  it.each(['light', 'dark', 'system'])('accepts the real theme %s', (value) => {
    expect(isTheme(value)).toBe(true)
  })

  it.each(['constructor', '__proto__', 'prototype', 'toString', 'hasOwnProperty', ''])(
    'rejects %j — including prototype-chain lookups on an unvalidated localStorage value',
    (value) => {
      expect(isTheme(value)).toBe(false)
    },
  )

  it('rejects null', () => {
    expect(isTheme(null)).toBe(false)
  })
})
