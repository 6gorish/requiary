/**
 * Cluster Selector
 *
 * Selects related messages based on similarity scoring.
 * Ensures traversal continuity by including previous focus.
 *
 * IMPORTANT: Pure business logic - NO visualization concepts.
 */

import type { GriefMessage, MessagePoolConfig } from '@/types/grief-messages'
import { sortBySimilarity } from '@/lib/utils/similarity-scoring'

/**
 * Cluster Selector Class
 *
 * Responsible for selecting which messages appear together in a cluster.
 * Uses similarity scoring to find related messages.
 * Maintains traversal continuity across clusters.
 */
export class ClusterSelector {
  private config: MessagePoolConfig

  constructor(config: MessagePoolConfig) {
    this.config = config

  }

  /**
   * Select Related Messages
   *
   * Chooses messages most similar to the focus message.
   * Ensures previous focus is ALWAYS included for traversal continuity.
   * Prefers first-class (priority) messages when available.
   *
   * @param focus - The focal message for this cluster
   * @param candidates - Pool of available messages
   * @param previousFocusId - ID of previous cluster's focus (null for first cluster)
   * @param priorityIds - Set of message IDs that are first-class (priority)
   * @returns Array of related messages with similarity scores
   *
   * @example
   * const related = selector.selectRelatedMessages(
   *   focusMessage,
   *   candidatePool,
   *   '12345',
   *   new Set(['msg1', 'msg2'])
   * )
   * console.log(`Selected ${related.length} related messages`)
   */
  selectRelatedMessages(
    focus: GriefMessage,
    candidates: GriefMessage[],
    previousFocusId: string | null,
    priorityIds: Set<string>
  ): Array<{ message: GriefMessage; similarity: number }> {

    // Filter out the focus message itself from candidates
    let availableCandidates = candidates.filter((msg) => msg.id !== focus.id)

    // Calculate how many slots we need
    const slotsNeeded = this.config.clusterSize - 1 // -1 for focus message itself

    // Reserve slot for previous focus if it exists
    let previousFocus: GriefMessage | null = null
    if (previousFocusId !== null) {
      previousFocus = availableCandidates.find((msg) => msg.id === previousFocusId) || null

      if (previousFocus) {
        // Remove from candidates so it doesn't get selected twice
        availableCandidates = availableCandidates.filter((msg) => msg.id !== previousFocusId)
      }
    }

    // If we have no candidates and no previous focus, return empty
    if (availableCandidates.length === 0 && previousFocus === null) {
      return []
    }

    // Calculate slots available for similarity-based selection
    const similaritySlots = previousFocus ? slotsNeeded - 1 : slotsNeeded

    // Sort candidates by similarity to focus
    const sorted = sortBySimilarity(focus, availableCandidates, this.config.similarity)

    // Separate into priority and non-priority messages
    const priorityMessages = sorted.filter((r) => priorityIds.has(r.message.id))
    const regularMessages = sorted.filter((r) => !priorityIds.has(r.message.id))

    // Fill slots preferring priority messages first
    const selectedMessages: Array<{ message: GriefMessage; similarity: number }> = []

    // Take all priority messages that fit
    const priorityToTake = Math.min(priorityMessages.length, similaritySlots)
    selectedMessages.push(...priorityMessages.slice(0, priorityToTake))

    // Fill remaining slots with regular messages
    const remainingSlots = similaritySlots - selectedMessages.length
    if (remainingSlots > 0) {
      selectedMessages.push(...regularMessages.slice(0, remainingSlots))
    }

    const similarMessages = selectedMessages

    // Build final related array
    const related: Array<{ message: GriefMessage; similarity: number }> = []

    // Add previous focus first (if exists) with similarity 1.0
    if (previousFocus) {
      related.push({
        message: previousFocus,
        similarity: 1.0 // Guaranteed inclusion
      })
    }

    // Add similarity-selected messages
    related.push(...similarMessages)

    return related
  }

  /**
   * Select Next Message
   *
   * Chooses the next focus message for traversal continuity.
   * REQUIRES first-class message if any exist in cluster.
   * Otherwise prefers highest similarity from related array.
   *
   * Strategy:
   * 1. If ANY first-class messages in cluster, one MUST be selected as next
   * 2. If no first-class messages, pick most similar from related
   * 3. If no related messages, pick from candidates (working set)
   * 4. Exclude current focus and previous focus from selection
   *
   * @param focus - Current focus message
   * @param related - Related messages from current cluster
   * @param candidates - Full pool of candidates (working set) - fallback only
   * @param previousFocusId - ID of previous focus (to prevent ping-pong)
   * @param priorityIds - Set of message IDs that are first-class (priority)
   * @returns Next focus message, or null if no messages available
   */
  selectNextMessage(
    focus: GriefMessage,
    related: Array<{ message: GriefMessage; similarity: number }>,
    candidates: GriefMessage[],
    previousFocusId: string | null,
    priorityIds: Set<string>
  ): GriefMessage | null {

    // CRITICAL REQUIREMENT: If ANY first-class messages in cluster, one MUST be next
    if (related.length > 0) {
      // Find first-class messages in cluster (excluding previous focus)
      const firstClassInCluster = related.filter(
        (r) => priorityIds.has(r.message.id) && r.message.id !== previousFocusId
      )

      if (firstClassInCluster.length > 0) {
        // MUST select a first-class message - pick first one (highest similarity among priority)
        const next = firstClassInCluster[0].message

        return next
      }

      // No first-class messages in cluster - use similarity-based selection

      // Filter out previous focus to prevent ping-pong between same messages
      const eligibleNext = related.filter((r) => r.message.id !== previousFocusId)

      if (eligibleNext.length > 0) {
        // Related array is already sorted by similarity (highest first)
        const next = eligibleNext[0].message

        return next
      }

      // If all related are the previous focus (shouldn't happen), fall through to candidates
    }

    // Fallback: Pick first candidate that's not the current focus
    const fallback = candidates.find((msg) => msg.id !== focus.id)

    if (fallback) {
      return fallback
    }

    // No next message available
    return null
  }

  /**
   * Validate Cluster
   *
   * Checks if a cluster meets minimum quality requirements.
   * Used to ensure clusters are meaningful and not degenerate.
   *
   * Validation criteria:
   * - Focus message exists
   * - Related messages meet minimum threshold (optional)
   * - No duplicate messages
   *
   * @param focus - Focus message
   * @param related - Related messages
   * @returns True if cluster is valid
   */
  validateCluster(
    focus: GriefMessage,
    related: Array<{ message: GriefMessage; similarity: number }>
  ): boolean {
    // Must have focus
    if (!focus) {
      return false
    }

    // Check for duplicate IDs
    const allIds = [focus.id, ...related.map((r) => r.message.id)]
    const uniqueIds = new Set(allIds)

    if (uniqueIds.size !== allIds.length) {
      // Find duplicates
      const seen = new Set<string>()
      const duplicates = allIds.filter(id => {
        if (seen.has(id)) return true
        seen.add(id)
        return false
      })
      return false
    }

    // Check that focus is not in related
    const focusInRelated = related.some((r) => r.message.id === focus.id)
    if (focusInRelated) {
      return false
    }

    return true
  }

  /**
   * Calculate Cluster Diversity
   *
   * Measures how diverse the selected messages are.
   * Higher diversity = better representation of message pool.
   *
   * Diversity metrics:
   * - Temporal spread (time range of messages)
   * - Length variance (mix of short and long messages)
   *
   * @param messages - All messages in cluster (focus + related)
   * @returns Diversity score (0-1, higher is more diverse)
   */
  calculateClusterDiversity(messages: GriefMessage[]): number {
    if (messages.length === 0) {
      return 0
    }

    if (messages.length === 1) {
      return 0 // Single message = no diversity
    }

    // Calculate temporal spread
    const timestamps = messages.map((msg) => new Date(msg.created_at).getTime())
    const minTime = Math.min(...timestamps)
    const maxTime = Math.max(...timestamps)
    const timeSpread = maxTime - minTime

    // Normalize: 30 days = max diversity
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    const temporalDiversity = Math.min(1, timeSpread / thirtyDaysMs)

    // Calculate length variance
    const lengths = messages.map((msg) => msg.content.length)
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length
    const variance =
      lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length
    const stdDev = Math.sqrt(variance)

    // Normalize: stdDev of 100 chars = max diversity
    const lengthDiversity = Math.min(1, stdDev / 100)

    // Combined diversity (equal weight)
    const diversity = (temporalDiversity + lengthDiversity) / 2

    return diversity
  }

  /**
   * Get Cluster Stats
   *
   * Returns statistics about cluster selection.
   * Useful for debugging and monitoring.
   *
   * @param focus - Focus message
   * @param related - Related messages
   * @returns Statistics object
   */
  getClusterStats(
    focus: GriefMessage,
    related: Array<{ message: GriefMessage; similarity: number }>
  ): {
    totalMessages: number
    avgSimilarity: number
    minSimilarity: number
    maxSimilarity: number
    diversity: number
  } {
    const allMessages = [focus, ...related.map((r) => r.message)]

    const similarities = related.map((r) => r.similarity)
    const avgSimilarity = similarities.length > 0
      ? similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length
      : 0

    const minSimilarity = similarities.length > 0 ? Math.min(...similarities) : 0
    const maxSimilarity = similarities.length > 0 ? Math.max(...similarities) : 0

    const diversity = this.calculateClusterDiversity(allMessages)

    return {
      totalMessages: allMessages.length,
      avgSimilarity,
      minSimilarity,
      maxSimilarity,
      diversity
    }
  }
}
