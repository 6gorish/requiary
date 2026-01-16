/**
 * Similarity Scoring Utility
 *
 * Calculates semantic similarity between grief messages.
 * Used by ClusterSelector to find related messages.
 *
 * Similarity factors:
 * - Temporal proximity (messages near in time)
 * - Length similarity (short vs long messages)
 * - Semantic similarity (embedding-based theme matching)
 */

import type { GriefMessage, MessagePoolConfig } from '@/types/grief-messages'
import { cosineSimilarity } from '@/lib/semantic-encoding'

/**
 * Calculate Similarity Score
 *
 * Computes weighted similarity between two messages.
 * Higher score = More similar.
 *
 * @param messageA - First message
 * @param messageB - Second message
 * @param config - Similarity configuration (weights)
 * @returns Similarity score (0.0 - 1.0)
 *
 * @example
 * const score = calculateSimilarity(msgA, msgB, config.similarity)
 * if (score > 0.7) {
 *   console.log('Highly similar messages')
 * }
 */
export function calculateSimilarity(
  messageA: GriefMessage,
  messageB: GriefMessage,
  config: MessagePoolConfig['similarity']
): number {
  // Temporal proximity score (0-1)
  const temporal = calculateTemporalProximity(
    messageA.created_at,
    messageB.created_at
  )

  // Length similarity score (0-1)
  const length = calculateLengthSimilarity(
    messageA.content.length,
    messageB.content.length
  )

  // Semantic similarity (embedding-based)
  const semantic = calculateSemanticSimilarity(messageA, messageB)

  // Weighted sum
  const totalWeight =
    config.temporalWeight + config.lengthWeight + config.semanticWeight

  // Normalize if weights don't sum to 1.0
  const normalizedScore =
    (temporal * config.temporalWeight +
      length * config.lengthWeight +
      semantic * config.semanticWeight) /
    totalWeight

  return Math.min(1.0, Math.max(0.0, normalizedScore))
}

/**
 * Calculate Temporal Proximity
 *
 * Measures how close two messages are in time.
 * Messages submitted near each other score higher.
 *
 * Formula:
 * - Same time = 1.0
 * - 30+ days apart = 0.0
 * - Linear decay between
 *
 * @param timeA - First timestamp (ISO 8601)
 * @param timeB - Second timestamp (ISO 8601)
 * @returns Proximity score (0-1)
 */
export function calculateTemporalProximity(
  timeA: string,
  timeB: string
): number {
  const dateA = new Date(timeA).getTime()
  const dateB = new Date(timeB).getTime()

  // Absolute time difference (milliseconds)
  const diff = Math.abs(dateA - dateB)

  // Normalize: 0 = same time, 1 = 30+ days apart
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

  // Invert: 1 = same time, 0 = 30+ days apart
  const proximity = Math.max(0, 1 - diff / thirtyDaysMs)

  return proximity
}

/**
 * Calculate Length Similarity
 *
 * Measures how similar two messages are in length.
 * Messages of similar length score higher.
 *
 * Formula:
 * - Identical length = 1.0
 * - Opposite extremes (1 char vs 280 chars) = 0.0
 * - Linear scaling between
 *
 * @param lengthA - First message length (characters)
 * @param lengthB - Second message length (characters)
 * @returns Similarity score (0-1)
 */
export function calculateLengthSimilarity(
  lengthA: number,
  lengthB: number
): number {
  const maxLength = 280 // Character limit for messages

  // Absolute length difference
  const diff = Math.abs(lengthA - lengthB)

  // Normalize: 0 = identical, 280 = opposite extremes
  // Invert: 1 = identical, 0 = opposite extremes
  const similarity = 1 - diff / maxLength

  return Math.max(0, similarity)
}

/**
 * Calculate Semantic Similarity
 *
 * Measures semantic/theme similarity between messages using embeddings.
 * Uses cosine similarity between 10-dimensional embedding vectors.
 *
 * Approach:
 * 1. Check if both messages have semantic embeddings
 * 2. Calculate cosine similarity between embedding vectors
 * 3. Normalize to 0-1 range (cosine similarity is -1 to 1)
 * 4. Return 0 if embeddings not available (fallback)
 *
 * @param messageA - First message
 * @param messageB - Second message
 * @returns Similarity score (0-1)
 */
export function calculateSemanticSimilarity(
  messageA: GriefMessage,
  messageB: GriefMessage
): number {
  // Check if both messages have semantic embeddings
  if (
    !messageA.semantic_data?.embedding ||
    !messageB.semantic_data?.embedding ||
    !Array.isArray(messageA.semantic_data.embedding) ||
    !Array.isArray(messageB.semantic_data.embedding) ||
    messageA.semantic_data.embedding.length !== 10 ||
    messageB.semantic_data.embedding.length !== 10
  ) {
    // No embeddings available - return 0 (no semantic similarity)
    return 0
  }

  try {
    // Calculate cosine similarity (-1 to 1)
    const cosineSim = cosineSimilarity(
      messageA.semantic_data.embedding,
      messageB.semantic_data.embedding
    )

    // Normalize to 0-1 range
    // Cosine similarity of -1 (opposite) → 0
    // Cosine similarity of 0 (orthogonal) → 0.5
    // Cosine similarity of 1 (identical) → 1
    const normalized = (cosineSim + 1) / 2

    return Math.min(1.0, Math.max(0.0, normalized))
  } catch (error) {
    console.error('Error calculating semantic similarity:', error)
    return 0
  }
}

/**
 * Sort Messages by Similarity
 *
 * Given a focus message and candidates, returns candidates
 * sorted by similarity (highest first).
 *
 * @param focus - Focus message to compare against
 * @param candidates - Messages to score and sort
 * @param config - Similarity configuration
 * @returns Sorted array with similarity scores
 *
 * @example
 * const sorted = sortBySimilarity(focus, candidates, config.similarity)
 * console.log(`Most similar: ${sorted[0].message.content}`)
 * console.log(`Similarity: ${sorted[0].similarity}`)
 */
export function sortBySimilarity(
  focus: GriefMessage,
  candidates: GriefMessage[],
  config: MessagePoolConfig['similarity']
): Array<{ message: GriefMessage; similarity: number }> {
  // Calculate similarity for each candidate
  const scored = candidates.map((message) => ({
    message,
    similarity: calculateSimilarity(focus, message, config)
  }))

  // Sort by similarity (highest first)
  scored.sort((a, b) => b.similarity - a.similarity)

  return scored
}

/**
 * Find Most Similar Message
 *
 * Returns the single most similar message from candidates.
 * Useful for selecting "next" message in traversal.
 *
 * @param focus - Focus message to compare against
 * @param candidates - Messages to search
 * @param config - Similarity configuration
 * @returns Most similar message or null if no candidates
 */
export function findMostSimilar(
  focus: GriefMessage,
  candidates: GriefMessage[],
  config: MessagePoolConfig['similarity']
): GriefMessage | null {
  if (candidates.length === 0) {
    return null
  }

  const sorted = sortBySimilarity(focus, candidates, config)
  return sorted[0].message
}
