/**
 * Tests for Semantic Encoding Module
 *
 * Tests cover:
 * - Cosine similarity calculation (unit tests with known vectors)
 * - Embedding generation (mocked API responses)
 * - Error handling (API failures, invalid responses)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSemanticEmbedding, cosineSimilarity } from '@/lib/semantic-encoding'

// Mock fetch globally
global.fetch = vi.fn()

describe('cosineSimilarity', () => {
  it('should return 1.0 for identical vectors', () => {
    const vec1 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const vec2 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    const similarity = cosineSimilarity(vec1, vec2)

    expect(similarity).toBe(1.0)
  })

  it('should return -1.0 for opposite vectors', () => {
    const vec1 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const vec2 = [-1, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    const similarity = cosineSimilarity(vec1, vec2)

    expect(similarity).toBe(-1.0)
  })

  it('should return 0.0 for orthogonal vectors', () => {
    const vec1 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const vec2 = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0]

    const similarity = cosineSimilarity(vec1, vec2)

    expect(similarity).toBe(0)
  })

  it('should return 0 for zero magnitude vectors', () => {
    const vec1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const vec2 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    const similarity = cosineSimilarity(vec1, vec2)

    expect(similarity).toBe(0)
  })

  it('should calculate correct similarity for complex vectors', () => {
    // Vectors with very high cosine similarity ≈ 0.9991
    const vec1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const vec2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11]

    const similarity = cosineSimilarity(vec1, vec2)

    // Allow small floating point error
    expect(similarity).toBeGreaterThan(0.998)
    expect(similarity).toBeLessThan(1.0)
  })

  it('should throw error for vectors of different lengths', () => {
    const vec1 = [1, 2, 3]
    const vec2 = [1, 2]

    expect(() => cosineSimilarity(vec1, vec2)).toThrow('Vectors must have same length')
  })

  it('should handle normalized vectors correctly', () => {
    // Pre-normalized vectors (magnitude = 1)
    const vec1 = [0.7071, 0.7071, 0, 0, 0, 0, 0, 0, 0, 0]
    const vec2 = [0.7071, 0.7071, 0, 0, 0, 0, 0, 0, 0, 0]

    const similarity = cosineSimilarity(vec1, vec2)

    expect(similarity).toBeCloseTo(1.0, 3)
  })
})

describe('getSemanticEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return valid 10-dimensional embedding on success', async () => {
    const mockEmbedding = [-0.8, 0.3, 0.7, -0.2, 0.9, -0.5, 0.1, 0.6, -0.4, 0.8]

    // Mock successful API response
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          text: JSON.stringify(mockEmbedding)
        }]
      })
    })

    const result = await getSemanticEmbedding('My mother. Every day I reach for the phone.')

    expect(result).toEqual(mockEmbedding)
    expect(result).toHaveLength(10)
  })

  it('should call Anthropic API with correct parameters', async () => {
    const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockEmbedding) }]
      })
    })

    const testContent = 'Test grief message'
    await getSemanticEmbedding(testContent)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        })
      })
    )

    const callArgs = (global.fetch as any).mock.calls[0][1]
    const body = JSON.parse(callArgs.body)

    expect(body.model).toBe('claude-sonnet-4-20250514')
    expect(body.max_tokens).toBe(500)
    expect(body.messages[0].role).toBe('user')
    expect(body.messages[0].content).toContain(testContent)
  })

  it('should return null on API error (non-200 status)', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500
    })

    const result = await getSemanticEmbedding('Test message')

    expect(result).toBeNull()
  })

  it('should return null on network error', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    const result = await getSemanticEmbedding('Test message')

    expect(result).toBeNull()
  })

  it('should return null for invalid embedding format (wrong length)', async () => {
    const invalidEmbedding = [0.1, 0.2, 0.3] // Only 3 dimensions instead of 10

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(invalidEmbedding) }]
      })
    })

    const result = await getSemanticEmbedding('Test message')

    expect(result).toBeNull()
  })

  it('should return null for invalid embedding format (not an array)', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: '"not an array"' }]
      })
    })

    const result = await getSemanticEmbedding('Test message')

    expect(result).toBeNull()
  })

  it('should return null for invalid JSON response', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: 'invalid json {{{' }]
      })
    })

    const result = await getSemanticEmbedding('Test message')

    expect(result).toBeNull()
  })

  it('should handle API rate limiting (429 status)', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 429
    })

    const result = await getSemanticEmbedding('Test message')

    expect(result).toBeNull()
  })

  it('should handle missing API key gracefully', async () => {
    // Save original API key
    const originalKey = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401
    })

    const result = await getSemanticEmbedding('Test message')

    expect(result).toBeNull()

    // Restore original API key
    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey
    }
  })

  it('should validate all values are in range -1.0 to 1.0', async () => {
    const validEmbedding = [-1.0, -0.5, 0, 0.5, 1.0, -0.8, 0.3, 0.7, -0.2, 0.9]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(validEmbedding) }]
      })
    })

    const result = await getSemanticEmbedding('Test message')

    expect(result).toEqual(validEmbedding)

    // Verify all values are in valid range
    result?.forEach(val => {
      expect(val).toBeGreaterThanOrEqual(-1.0)
      expect(val).toBeLessThanOrEqual(1.0)
    })
  })

  it('should handle empty content gracefully', async () => {
    const mockEmbedding = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockEmbedding) }]
      })
    })

    const result = await getSemanticEmbedding('')

    // Should still call API and get a result
    expect(result).toBeDefined()
    expect(global.fetch).toHaveBeenCalled()
  })

  it('should handle very long content (280 characters)', async () => {
    const longContent = 'a'.repeat(280)
    const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockEmbedding) }]
      })
    })

    const result = await getSemanticEmbedding(longContent)

    expect(result).toEqual(mockEmbedding)

    const callArgs = (global.fetch as any).mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    expect(body.messages[0].content).toContain(longContent)
  })
})
