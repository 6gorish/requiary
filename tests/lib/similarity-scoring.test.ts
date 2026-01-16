/**
 * Tests for Similarity Scoring Utility
 *
 * Tests cover:
 * - Semantic similarity calculation with embeddings
 * - Weighted similarity scoring (temporal + length + semantic)
 * - Fallback behavior when embeddings unavailable
 * - Integration with cosine similarity
 */

import { describe, it, expect } from 'vitest'
import {
  calculateSimilarity,
  calculateSemanticSimilarity,
  calculateTemporalProximity,
  calculateLengthSimilarity,
  sortBySimilarity,
  findMostSimilar
} from '@/lib/utils/similarity-scoring'
import type { GriefMessage, MessagePoolConfig } from '@/types/grief-messages'

// Test configuration with semantic weight
const testConfig: MessagePoolConfig['similarity'] = {
  temporalWeight: 0.2,
  lengthWeight: 0.2,
  semanticWeight: 0.6
}

// Helper to create test messages
function createMessage(
  id: string,
  content: string,
  createdAt: string,
  embedding?: number[] | null
): GriefMessage {
  return {
    id,
    content,
    created_at: createdAt,
    approved: true,
    deleted_at: null,
    semantic_data: embedding
      ? {
          embedding,
          generated_at: createdAt
        }
      : null
  }
}

describe('calculateSemanticSimilarity', () => {
  it('should return 0 when neither message has embeddings', () => {
    const msgA = createMessage('1', 'Test A', '2025-01-01T00:00:00Z')
    const msgB = createMessage('2', 'Test B', '2025-01-01T00:00:00Z')

    const similarity = calculateSemanticSimilarity(msgA, msgB)

    expect(similarity).toBe(0)
  })

  it('should return 0 when only one message has embedding', () => {
    const msgA = createMessage('1', 'Test A', '2025-01-01T00:00:00Z', [1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const msgB = createMessage('2', 'Test B', '2025-01-01T00:00:00Z')

    const similarity = calculateSemanticSimilarity(msgA, msgB)

    expect(similarity).toBe(0)
  })

  it('should return 1.0 for identical embeddings', () => {
    const embedding = [0.8, -0.3, 0.5, 0.2, -0.7, 0.4, -0.1, 0.6, 0.9, -0.5]
    const msgA = createMessage('1', 'Test A', '2025-01-01T00:00:00Z', embedding)
    const msgB = createMessage('2', 'Test B', '2025-01-01T00:00:00Z', embedding)

    const similarity = calculateSemanticSimilarity(msgA, msgB)

    // Cosine similarity = 1.0, normalized to (1 + 1) / 2 = 1.0
    expect(similarity).toBe(1.0)
  })

  it('should return 0.0 for opposite embeddings', () => {
    const embeddingA = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const embeddingB = [-1, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    const msgA = createMessage('1', 'Test A', '2025-01-01T00:00:00Z', embeddingA)
    const msgB = createMessage('2', 'Test B', '2025-01-01T00:00:00Z', embeddingB)

    const similarity = calculateSemanticSimilarity(msgA, msgB)

    // Cosine similarity = -1.0, normalized to (-1 + 1) / 2 = 0.0
    expect(similarity).toBe(0.0)
  })

  it('should return 0.5 for orthogonal embeddings', () => {
    const embeddingA = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const embeddingB = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0]

    const msgA = createMessage('1', 'Test A', '2025-01-01T00:00:00Z', embeddingA)
    const msgB = createMessage('2', 'Test B', '2025-01-01T00:00:00Z', embeddingB)

    const similarity = calculateSemanticSimilarity(msgA, msgB)

    // Cosine similarity = 0.0, normalized to (0 + 1) / 2 = 0.5
    expect(similarity).toBe(0.5)
  })

  it('should return 0 for embeddings with wrong length', () => {
    const embeddingA = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const embeddingB = [1, 0, 0] // Only 3 dimensions

    const msgA = createMessage('1', 'Test A', '2025-01-01T00:00:00Z', embeddingA)
    const msgB = createMessage('2', 'Test B', '2025-01-01T00:00:00Z', embeddingB)

    const similarity = calculateSemanticSimilarity(msgA, msgB)

    expect(similarity).toBe(0)
  })

  it('should return 0 when embedding is not an array', () => {
    const msgA = createMessage('1', 'Test A', '2025-01-01T00:00:00Z', [1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const msgB = {
      ...createMessage('2', 'Test B', '2025-01-01T00:00:00Z'),
      semantic_data: {
        embedding: 'not an array' as any,
        generated_at: '2025-01-01T00:00:00Z'
      }
    }

    const similarity = calculateSemanticSimilarity(msgA, msgB)

    expect(similarity).toBe(0)
  })

  it('should calculate correct similarity for similar themes', () => {
    // Similar theme vectors (slight variation)
    const embeddingA = [0.8, 0.3, 0.5, -0.2, 0.7, -0.4, 0.1, 0.6, -0.3, 0.9]
    const embeddingB = [0.75, 0.35, 0.52, -0.18, 0.68, -0.38, 0.12, 0.58, -0.28, 0.88]

    const msgA = createMessage('1', 'Missing my mother', '2025-01-01T00:00:00Z', embeddingA)
    const msgB = createMessage('2', 'My mom passed away', '2025-01-01T00:00:00Z', embeddingB)

    const similarity = calculateSemanticSimilarity(msgA, msgB)

    // Should be high similarity (close to 1.0)
    expect(similarity).toBeGreaterThan(0.9)
    expect(similarity).toBeLessThanOrEqual(1.0)
  })
})

describe('calculateSimilarity with semantic weighting', () => {
  it('should use semantic similarity when embeddings available', () => {
    const embedding = [0.8, -0.3, 0.5, 0.2, -0.7, 0.4, -0.1, 0.6, 0.9, -0.5]
    const msgA = createMessage('1', 'Test message A', '2025-01-01T00:00:00Z', embedding)
    const msgB = createMessage('2', 'Test message B', '2025-01-01T00:01:00Z', embedding)

    const similarity = calculateSimilarity(msgA, msgB, testConfig)

    // With identical embeddings (semantic = 1.0) and other factors,
    // result should be heavily weighted toward semantic (0.6 weight)
    expect(similarity).toBeGreaterThan(0.6) // At least semantic component
    expect(similarity).toBeLessThanOrEqual(1.0)
  })

  it('should fall back to temporal+length when no embeddings', () => {
    const msgA = createMessage('1', 'Test A', '2025-01-01T00:00:00Z')
    const msgB = createMessage('2', 'Test B', '2025-01-01T00:00:00Z')

    const similarity = calculateSimilarity(msgA, msgB, testConfig)

    // Without semantic similarity (0), should use only temporal + length
    // Both at same time (temporal=1.0) and same length (length=1.0)
    // Result: (1.0 * 0.2 + 1.0 * 0.2 + 0 * 0.6) / 1.0 = 0.4
    expect(similarity).toBeCloseTo(0.4, 2)
  })

  it('should properly weight all three factors', () => {
    const embeddingA = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const embeddingB = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    // Same time, same length, identical embeddings
    const msgA = createMessage('1', 'Short', '2025-01-01T00:00:00Z', embeddingA)
    const msgB = createMessage('2', 'Short', '2025-01-01T00:00:00Z', embeddingB)

    const similarity = calculateSimilarity(msgA, msgB, testConfig)

    // temporal=1.0, length=1.0, semantic=1.0
    // (1.0 * 0.2 + 1.0 * 0.2 + 1.0 * 0.6) / 1.0 = 1.0
    expect(similarity).toBe(1.0)
  })

  it('should handle opposite semantic vectors with good temporal/length', () => {
    const embeddingA = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const embeddingB = [-1, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    // Same time, same length, opposite embeddings
    const msgA = createMessage('1', 'Short', '2025-01-01T00:00:00Z', embeddingA)
    const msgB = createMessage('2', 'Short', '2025-01-01T00:00:00Z', embeddingB)

    const similarity = calculateSimilarity(msgA, msgB, testConfig)

    // temporal=1.0, length=1.0, semantic=0.0 (opposite)
    // (1.0 * 0.2 + 1.0 * 0.2 + 0.0 * 0.6) / 1.0 = 0.4
    expect(similarity).toBeCloseTo(0.4, 2)
  })

  it('should normalize weights that do not sum to 1.0', () => {
    const config: MessagePoolConfig['similarity'] = {
      temporalWeight: 1.0,
      lengthWeight: 1.0,
      semanticWeight: 1.0
    }

    const embedding = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const msgA = createMessage('1', 'Test', '2025-01-01T00:00:00Z', embedding)
    const msgB = createMessage('2', 'Test', '2025-01-01T00:00:00Z', embedding)

    const similarity = calculateSimilarity(msgA, msgB, config)

    // Should normalize: (1.0 * 1.0 + 1.0 * 1.0 + 1.0 * 1.0) / 3.0 = 1.0
    expect(similarity).toBe(1.0)
  })
})

describe('sortBySimilarity with semantic embeddings', () => {
  it('should prioritize semantic similarity when available', () => {
    const focusEmbedding = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const similarEmbedding = [0.9, 0.1, 0, 0, 0, 0, 0, 0, 0, 0]
    const differentEmbedding = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0]

    const focus = createMessage('focus', 'Focus message', '2025-01-01T00:00:00Z', focusEmbedding)
    const similar = createMessage('similar', 'Similar theme', '2025-01-15T00:00:00Z', similarEmbedding)
    const different = createMessage('different', 'Different theme', '2025-01-02T00:00:00Z', differentEmbedding)

    const candidates = [different, similar] // Different is closer in time but semantically different
    const sorted = sortBySimilarity(focus, candidates, testConfig)

    // Should prioritize semantic similarity over temporal proximity
    expect(sorted[0].message.id).toBe('similar')
    expect(sorted[1].message.id).toBe('different')
  })

  it('should sort by temporal when no embeddings available', () => {
    const focus = createMessage('focus', 'Focus', '2025-01-15T00:00:00Z')
    const near = createMessage('near', 'Near in time', '2025-01-16T00:00:00Z')
    const far = createMessage('far', 'Far in time', '2025-01-01T00:00:00Z')

    const candidates = [far, near]
    const sorted = sortBySimilarity(focus, candidates, testConfig)

    expect(sorted[0].message.id).toBe('near')
    expect(sorted[1].message.id).toBe('far')
  })

  it('should handle mix of messages with and without embeddings', () => {
    const focusEmbedding = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const similarEmbedding = [0.9, 0.1, 0, 0, 0, 0, 0, 0, 0, 0]

    const focus = createMessage('focus', 'Focus', '2025-01-15T00:00:00Z', focusEmbedding)
    const withEmbedding = createMessage('with', 'Has embedding', '2025-01-20T00:00:00Z', similarEmbedding)
    const withoutEmbedding = createMessage('without', 'No embedding', '2025-01-16T00:00:00Z')

    const candidates = [withoutEmbedding, withEmbedding]
    const sorted = sortBySimilarity(focus, candidates, testConfig)

    // Message with embedding should rank higher due to semantic weight
    expect(sorted[0].message.id).toBe('with')
  })
})

describe('findMostSimilar with semantic embeddings', () => {
  it('should return most semantically similar message', () => {
    const focusEmbedding = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const mostSimilarEmbedding = [0.95, 0.05, 0, 0, 0, 0, 0, 0, 0, 0]
    const lessSimilarEmbedding = [0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0]

    const focus = createMessage('focus', 'Focus', '2025-01-01T00:00:00Z', focusEmbedding)
    const mostSimilar = createMessage('most', 'Most similar', '2025-01-10T00:00:00Z', mostSimilarEmbedding)
    const lessSimilar = createMessage('less', 'Less similar', '2025-01-02T00:00:00Z', lessSimilarEmbedding)

    const candidates = [lessSimilar, mostSimilar]
    const result = findMostSimilar(focus, candidates, testConfig)

    expect(result?.id).toBe('most')
  })

  it('should return null for empty candidates', () => {
    const focus = createMessage('focus', 'Focus', '2025-01-01T00:00:00Z')

    const result = findMostSimilar(focus, [], testConfig)

    expect(result).toBeNull()
  })
})

describe('temporal and length similarity (existing functionality)', () => {
  it('calculateTemporalProximity should work as before', () => {
    const sameTime = calculateTemporalProximity('2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
    expect(sameTime).toBe(1.0)

    const oneDayApart = calculateTemporalProximity('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z')
    expect(oneDayApart).toBeGreaterThan(0.9)

    const thirtyDaysApart = calculateTemporalProximity('2025-01-01T00:00:00Z', '2025-01-31T00:00:00Z')
    expect(thirtyDaysApart).toBeCloseTo(0, 1)
  })

  it('calculateLengthSimilarity should work as before', () => {
    const identical = calculateLengthSimilarity(100, 100)
    expect(identical).toBe(1.0)

    const close = calculateLengthSimilarity(100, 110)
    expect(close).toBeGreaterThan(0.9)

    const opposite = calculateLengthSimilarity(1, 280)
    expect(opposite).toBeCloseTo(0.004, 2)
  })
})
