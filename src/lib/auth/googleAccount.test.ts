import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateGoogleSignInPolicy,
  isGoogleEmailVerified,
  normalizeGoogleProfile,
} from './googleAccount'

describe('isGoogleEmailVerified', () => {
  it('accepts boolean and string true', () => {
    assert.equal(isGoogleEmailVerified({ email_verified: true }), true)
    assert.equal(isGoogleEmailVerified({ email_verified: 'true' }), true)
  })

  it('rejects false and missing', () => {
    assert.equal(isGoogleEmailVerified({ email_verified: false }), false)
    assert.equal(isGoogleEmailVerified({}), false)
  })
})

describe('normalizeGoogleProfile', () => {
  it('normalizes email and defaults name', () => {
    assert.deepEqual(normalizeGoogleProfile({ email: 'Alex@Example.COM', name: 'Alex' }), {
      email: 'alex@example.com',
      name: 'Alex',
      avatar: '',
    })
  })

  it('rejects missing email', () => {
    assert.equal(normalizeGoogleProfile({ name: 'Alex' }), null)
  })
})

describe('evaluateGoogleSignInPolicy', () => {
  const profile = {
    email: 'user@example.com',
    name: 'User',
    picture: 'https://example.com/a.png',
    email_verified: true,
  }

  it('rejects unverified email', () => {
    const result = evaluateGoogleSignInPolicy({
      profile: { ...profile, email_verified: false },
      existingUser: null,
      allowPublicRegistration: true,
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'unverified_email')
  })

  it('links to existing active account without marking new', () => {
    const result = evaluateGoogleSignInPolicy({
      profile,
      existingUser: { isActive: true },
      allowPublicRegistration: false,
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.isNewUser, false)
  })

  it('rejects inactive existing account', () => {
    const result = evaluateGoogleSignInPolicy({
      profile,
      existingUser: { isActive: false },
      allowPublicRegistration: true,
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'inactive')
  })

  it('blocks first-time signup when registration disabled', () => {
    const result = evaluateGoogleSignInPolicy({
      profile,
      existingUser: null,
      allowPublicRegistration: false,
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'registration_disabled')
  })

  it('allows first-time user when registration enabled', () => {
    const result = evaluateGoogleSignInPolicy({
      profile,
      existingUser: null,
      allowPublicRegistration: true,
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.isNewUser, true)
  })
})
