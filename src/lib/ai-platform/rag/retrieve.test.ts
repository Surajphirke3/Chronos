import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { chunkText } from './retrieve'

describe('rag chunking', () => {
  it('chunks long text', () => {
    const text = 'word '.repeat(500)
    const chunks = chunkText(text, 100)
    assert.ok(chunks.length > 1)
    assert.ok(chunks.every((c) => c.length <= 100))
  })
})
