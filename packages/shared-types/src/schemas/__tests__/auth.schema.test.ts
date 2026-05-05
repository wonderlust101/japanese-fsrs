import { describe, it, expect } from 'bun:test'

import {
  signupSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  cancelSignupSchema,
  refreshSchema,
} from '../auth.schema.ts'

describe('auth.schema — signupSchema', () => {
  it('accepts a well-formed signup body', () => {
    const result = signupSchema.safeParse({
      email:        'alice@example.com',
      password:     'a-strong-pass-123',
      display_name: 'Alice',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email addresses', () => {
    const result = signupSchema.safeParse({
      email:        'not-an-email',
      password:     'a-strong-pass-123',
      display_name: 'Alice',
    })
    expect(result.success).toBe(false)
  })

  it('rejects passwords below the minimum length', () => {
    const result = signupSchema.safeParse({
      email:        'alice@example.com',
      password:     'short',
      display_name: 'Alice',
    })
    expect(result.success).toBe(false)
  })
})

describe('auth.schema — loginSchema', () => {
  it('accepts an email + password pair', () => {
    expect(loginSchema.safeParse({
      email:    'alice@example.com',
      password: 'doesnt-matter-here',
    }).success).toBe(true)
  })

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({
      email:    'alice@example.com',
      password: '',
    }).success).toBe(false)
  })
})

describe('auth.schema — verifyOtpSchema', () => {
  it('accepts a 6-digit numeric code', () => {
    expect(verifyOtpSchema.safeParse({
      email: 'alice@example.com',
      token: '123456',
    }).success).toBe(true)
  })

  it('rejects a non-6-digit code', () => {
    expect(verifyOtpSchema.safeParse({
      email: 'alice@example.com',
      token: '12345',
    }).success).toBe(false)
    expect(verifyOtpSchema.safeParse({
      email: 'alice@example.com',
      token: '1234567',
    }).success).toBe(false)
  })
})

describe('auth.schema — resendOtpSchema and cancelSignupSchema', () => {
  it('resendOtp accepts an email', () => {
    expect(resendOtpSchema.safeParse({ email: 'alice@example.com' }).success).toBe(true)
  })

  it('cancelSignup accepts a UUID userId', () => {
    expect(cancelSignupSchema.safeParse({
      userId: '00000000-0000-4000-8000-000000000001',
    }).success).toBe(true)
  })

  it('cancelSignup rejects a non-UUID userId', () => {
    expect(cancelSignupSchema.safeParse({ userId: 'abc' }).success).toBe(false)
  })
})

describe('auth.schema — refreshSchema', () => {
  it('accepts a refreshToken string', () => {
    expect(refreshSchema.safeParse({ refreshToken: 'rt-1234' }).success).toBe(true)
  })

  it('rejects empty refreshToken', () => {
    expect(refreshSchema.safeParse({ refreshToken: '' }).success).toBe(false)
  })
})
