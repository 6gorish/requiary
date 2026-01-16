/**
 * Cluster Selector Tests
 *
 * Unit tests for ClusterSelector service.
 * Tests message selection, similarity scoring, and validation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ClusterSelector } from '@/lib/services/cluster-selector'
import type { MessagePoolConfig } from '@/types/grief-messages'
import { createTestMessages, createTestMessage } from '../mocks/database-service'
import { DEFAULT_CONFIG } from '@/lib/config/message-pool-config'

describe('ClusterSelector', () => {
  let selector: ClusterSelector
  let config: MessagePoolConfig

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG }
    selector = new ClusterSelector(config)
  })

  describe('selectRelatedMessages', () => {
    it('should select messages based on similarity', () => {
      const messages = createTestMessages(50)
      const focus = messages[0]
      const candidates = messages.slice(1)

      const related = selector.selectRelatedMessages(focus, candidates, null, new Set())

      expect(related.length).toBeLessThanOrEqual(config.clusterSize - 1)
      expect(related.every((r) => r.message.id !== focus.id)).toBe(true)
    })

    it('should include previous focus when provided', () => {
      const messages = createTestMessages(50)
      const focus = messages[10]
      const previousFocus = messages[5]
      const candidates = messages

      const related = selector.selectRelatedMessages(
        focus,
        candidates,
        previousFocus.id,
        new Set()
      )

      const hasPreviousFocus = related.some((r) => r.message.id === previousFocus.id)
      expect(hasPreviousFocus).toBe(true)

      // Previous focus should have similarity 1.0 (guaranteed inclusion)
      const prevInRelated = related.find((r) => r.message.id === previousFocus.id)
      expect(prevInRelated?.similarity).toBe(1.0)
    })

    it('should not include focus message in related array', () => {
      const messages = createTestMessages(50)
      const focus = messages[0]
      const candidates = messages

      const related = selector.selectRelatedMessages(focus, candidates, null, new Set())

      const hasFocus = related.some((r) => r.message.id === focus.id)
      expect(hasFocus).toBe(false)
    })

    it('should handle empty candidates', () => {
      const focus = createTestMessage(1, 'Focus')
      const candidates: any[] = []

      const related = selector.selectRelatedMessages(focus, candidates, null, new Set())

      expect(related.length).toBe(0)
    })

    it('should handle single candidate', () => {
      const focus = createTestMessage(1, 'Focus')
      const candidates = [createTestMessage(2, 'Single candidate')]

      const related = selector.selectRelatedMessages(focus, candidates, null, new Set())

      expect(related.length).toBeLessThanOrEqual(1)
    })

    it('should respect cluster size limit', () => {
      const messages = createTestMessages(100)
      const focus = messages[0]
      const candidates = messages.slice(1)

      const related = selector.selectRelatedMessages(focus, candidates, null, new Set())

      // Should not exceed clusterSize - 1 (accounting for focus)
      expect(related.length).toBeLessThanOrEqual(config.clusterSize - 1)
    })

    it('should prioritize messages with higher similarity', () => {
      const baseTime = new Date('2024-01-01T00:00:00Z')

      const focus = createTestMessage(1, 'Short', baseTime)

      // Create candidates with varying similarity
      const closeTemporal = createTestMessage(
        2,
        'Short', // Similar length
        new Date(baseTime.getTime() + 60000) // 1 minute later
      )

      const farTemporal = createTestMessage(
        3,
        'Short',
        new Date(baseTime.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days later
      )

      const candidates = [farTemporal, closeTemporal]

      const related = selector.selectRelatedMessages(focus, candidates, null, new Set())

      // Close temporal should be selected first (higher similarity)
      expect(related[0].message.id).toBe(closeTemporal.id)
    })

    it('should prefer first-class (priority) messages over regular messages', () => {
      const messages = createTestMessages(20)
      const focus = messages[0]
      const candidates = messages.slice(1)

      // Mark some messages as priority
      const priorityIds = new Set([messages[5].id, messages[10].id, messages[15].id])

      const related = selector.selectRelatedMessages(
        focus,
        candidates,
        null,
        priorityIds
      )

      // All priority messages should be selected if they fit
      const selectedPriorityIds = related
        .map((r) => r.message.id)
        .filter((id) => priorityIds.has(id))

      // Should have selected all available priority messages (3)
      expect(selectedPriorityIds.length).toBe(3)

      // Priority messages should appear first in related array
      const firstThree = related.slice(0, 3).map((r) => r.message.id)
      expect(firstThree.every((id) => priorityIds.has(id))).toBe(true)
    })

    it('should still include previous focus even when not a priority message', () => {
      const messages = createTestMessages(20)
      const focus = messages[10]
      const previousFocus = messages[5]
      const candidates = messages

      // Mark some messages as priority (NOT including previous focus)
      const priorityIds = new Set([messages[1].id, messages[2].id, messages[3].id])

      const related = selector.selectRelatedMessages(
        focus,
        candidates,
        previousFocus.id,
        priorityIds
      )

      // Previous focus MUST still be included
      const hasPreviousFocus = related.some((r) => r.message.id === previousFocus.id)
      expect(hasPreviousFocus).toBe(true)

      // Previous focus should be first (similarity 1.0)
      expect(related[0].message.id).toBe(previousFocus.id)
    })

    it('should handle when no priority messages available', () => {
      const messages = createTestMessages(20)
      const focus = messages[0]
      const candidates = messages.slice(1)

      // Empty priority set
      const priorityIds = new Set<string>()

      const related = selector.selectRelatedMessages(
        focus,
        candidates,
        null,
        priorityIds
      )

      // Should still select messages based on similarity
      expect(related.length).toBeGreaterThan(0)
      expect(related.length).toBeLessThanOrEqual(config.clusterSize - 1)
    })
  })

  describe('selectNextMessage', () => {
    it('should select from related messages if available', () => {
      const messages = createTestMessages(10)
      const focus = messages[0]
      const related = [
        { message: messages[1], similarity: 0.9 },
        { message: messages[2], similarity: 0.7 }
      ]
      const candidates = messages

      const next = selector.selectNextMessage(focus, related, candidates, null, new Set())

      expect(next).toBe(messages[1]) // Highest similarity
    })

    it('should fallback to candidates if no related messages', () => {
      const messages = createTestMessages(10)
      const focus = messages[0]
      const related: any[] = []
      const candidates = messages

      const next = selector.selectNextMessage(focus, related, candidates, null, new Set())

      expect(next).toBeTruthy()
      expect(next?.id).not.toBe(focus.id)
    })

    it('should not select current focus as next', () => {
      const focus = createTestMessage(1, 'Focus')
      const related: any[] = []
      const candidates = [focus, createTestMessage(2, 'Other')]

      const next = selector.selectNextMessage(focus, related, candidates, null, new Set())

      expect(next?.id).not.toBe(focus.id)
    })

    it('should return null if no messages available', () => {
      const focus = createTestMessage(1, 'Focus')
      const related: any[] = []
      const candidates = [focus] // Only focus available

      const next = selector.selectNextMessage(focus, related, candidates, null, new Set())

      expect(next).toBeNull()
    })

    it('should not select previous focus as next (prevent ping-pong)', () => {
      const messages = createTestMessages(10)
      const focus = messages[5]
      const previousFocus = messages[3]
      const related = [
        { message: previousFocus, similarity: 1.0 }, // Previous focus has highest similarity
        { message: messages[6], similarity: 0.8 },
        { message: messages[7], similarity: 0.7 }
      ]
      const candidates = messages

      const next = selector.selectNextMessage(focus, related, candidates, previousFocus.id, new Set())

      // Should NOT select previous focus (even though it has highest similarity)
      expect(next?.id).not.toBe(previousFocus.id)
      // Should select next highest similarity
      expect(next?.id).toBe(messages[6].id)
    })

    it('should REQUIRE first-class message as next if any exist in cluster', () => {
      const messages = createTestMessages(10)
      const focus = messages[0]

      // Mark one message as priority
      const priorityIds = new Set([messages[3].id])

      const related = [
        { message: messages[1], similarity: 0.95 }, // Higher similarity, NOT priority
        { message: messages[2], similarity: 0.90 }, // NOT priority
        { message: messages[3], similarity: 0.70 }, // Lower similarity, but IS priority
        { message: messages[4], similarity: 0.60 }  // NOT priority
      ]
      const candidates = messages

      const next = selector.selectNextMessage(
        focus,
        related,
        candidates,
        null,
        priorityIds
      )

      // MUST select the priority message even though it has lower similarity
      expect(next?.id).toBe(messages[3].id)
    })

    it('should select multiple first-class messages in order if available', () => {
      const messages = createTestMessages(10)
      const focus = messages[0]

      // Mark two messages as priority
      const priorityIds = new Set([messages[2].id, messages[4].id])

      const related = [
        { message: messages[1], similarity: 0.95 }, // NOT priority
        { message: messages[2], similarity: 0.85 }, // Priority (higher similarity among priority)
        { message: messages[3], similarity: 0.80 }, // NOT priority
        { message: messages[4], similarity: 0.70 }  // Priority (lower similarity among priority)
      ]
      const candidates = messages

      const next = selector.selectNextMessage(
        focus,
        related,
        candidates,
        null,
        priorityIds
      )

      // Should select first priority message (messages[2], highest similarity among priority)
      expect(next?.id).toBe(messages[2].id)
    })

    it('should use regular selection when no first-class messages in cluster', () => {
      const messages = createTestMessages(10)
      const focus = messages[0]

      // Mark a message as priority, but it's NOT in the cluster
      const priorityIds = new Set([messages[9].id])

      const related = [
        { message: messages[1], similarity: 0.95 }, // NOT priority, but highest similarity
        { message: messages[2], similarity: 0.85 }, // NOT priority
        { message: messages[3], similarity: 0.75 }  // NOT priority
      ]
      const candidates = messages

      const next = selector.selectNextMessage(
        focus,
        related,
        candidates,
        null,
        priorityIds
      )

      // Should use regular selection (highest similarity)
      expect(next?.id).toBe(messages[1].id)
    })

    it('should not select previous focus even if it is first-class', () => {
      const messages = createTestMessages(10)
      const focus = messages[5]
      const previousFocus = messages[3]

      // Mark previous focus as priority
      const priorityIds = new Set([previousFocus.id, messages[6].id])

      const related = [
        { message: previousFocus, similarity: 1.0 }, // Previous focus, also priority
        { message: messages[6], similarity: 0.80 }   // Priority
      ]
      const candidates = messages

      const next = selector.selectNextMessage(
        focus,
        related,
        candidates,
        previousFocus.id,
        priorityIds
      )

      // Should NOT select previous focus even though it's priority with highest similarity
      // Should select the other priority message
      expect(next?.id).toBe(messages[6].id)
    })
  })

  describe('validateCluster', () => {
    it('should validate correct cluster', () => {
      const messages = createTestMessages(10)
      const focus = messages[0]
      const related = [
        { message: messages[1], similarity: 0.9 },
        { message: messages[2], similarity: 0.8 }
      ]

      const isValid = selector.validateCluster(focus, related)

      expect(isValid).toBe(true)
    })

    it('should reject cluster with no focus', () => {
      const messages = createTestMessages(10)
      const related = [
        { message: messages[1], similarity: 0.9 }
      ]

      const isValid = selector.validateCluster(null as any, related)

      expect(isValid).toBe(false)
    })

    it('should reject cluster with duplicate messages', () => {
      const messages = createTestMessages(10)
      const focus = messages[0]
      const related = [
        { message: messages[1], similarity: 0.9 },
        { message: messages[1], similarity: 0.8 } // Duplicate!
      ]

      const isValid = selector.validateCluster(focus, related)

      expect(isValid).toBe(false)
    })

    it('should reject cluster with focus in related', () => {
      const messages = createTestMessages(10)
      const focus = messages[0]
      const related = [
        { message: focus, similarity: 1.0 }, // Focus should not be in related!
        { message: messages[1], similarity: 0.9 }
      ]

      const isValid = selector.validateCluster(focus, related)

      expect(isValid).toBe(false)
    })
  })

  describe('calculateClusterDiversity', () => {
    it('should return 0 for empty cluster', () => {
      const diversity = selector.calculateClusterDiversity([])

      expect(diversity).toBe(0)
    })

    it('should return 0 for single message', () => {
      const messages = createTestMessages(1)

      const diversity = selector.calculateClusterDiversity(messages)

      expect(diversity).toBe(0)
    })

    it('should return higher diversity for spread out messages', () => {
      const baseTime = new Date('2024-01-01T00:00:00Z')

      // Cluster 1: Messages close together
      const closeMessages = [
        createTestMessage(1, 'Short', baseTime),
        createTestMessage(2, 'Short', new Date(baseTime.getTime() + 60000))
      ]

      // Cluster 2: Messages far apart
      const spreadMessages = [
        createTestMessage(3, 'Short message', baseTime),
        createTestMessage(4, 'This is a much longer message with more content',
          new Date(baseTime.getTime() + 15 * 24 * 60 * 60 * 1000))
      ]

      const closeDiversity = selector.calculateClusterDiversity(closeMessages)
      const spreadDiversity = selector.calculateClusterDiversity(spreadMessages)

      expect(spreadDiversity).toBeGreaterThan(closeDiversity)
    })

    it('should consider both temporal and length diversity', () => {
      const baseTime = new Date('2024-01-01T00:00:00Z')

      const messages = [
        createTestMessage(1, 'Short', baseTime),
        createTestMessage(2, 'This is a very long message',
          new Date(baseTime.getTime() + 10 * 24 * 60 * 60 * 1000))
      ]

      const diversity = selector.calculateClusterDiversity(messages)

      expect(diversity).toBeGreaterThan(0)
      expect(diversity).toBeLessThanOrEqual(1)
    })
  })

  describe('getClusterStats', () => {
    it('should return correct statistics', () => {
      const messages = createTestMessages(10)
      const focus = messages[0]
      const related = [
        { message: messages[1], similarity: 0.9 },
        { message: messages[2], similarity: 0.7 },
        { message: messages[3], similarity: 0.5 }
      ]

      const stats = selector.getClusterStats(focus, related)

      expect(stats.totalMessages).toBe(4) // focus + 3 related
      expect(stats.avgSimilarity).toBeCloseTo((0.9 + 0.7 + 0.5) / 3)
      expect(stats.minSimilarity).toBe(0.5)
      expect(stats.maxSimilarity).toBe(0.9)
      expect(stats.diversity).toBeGreaterThanOrEqual(0)
    })

    it('should handle cluster with no related messages', () => {
      const focus = createTestMessage(1, 'Focus')
      const related: any[] = []

      const stats = selector.getClusterStats(focus, related)

      expect(stats.totalMessages).toBe(1)
      expect(stats.avgSimilarity).toBe(0)
      expect(stats.minSimilarity).toBe(0)
      expect(stats.maxSimilarity).toBe(0)
    })
  })
})
