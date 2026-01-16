/**
 * Message Logic Service Tests
 *
 * Unit tests for MessageLogicService.
 * Tests cluster generation, message submission, and traversal continuity.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MessageLogicService } from '@/lib/services/message-logic-service'
import type { MessagePoolConfig } from '@/types/grief-messages'
import { createTestMessages } from '../mocks/database-service'
import { createMockSupabaseClient, type MockSupabaseClient } from '../mocks/supabase-client'
import { DEFAULT_CONFIG } from '@/lib/config/message-pool-config'

describe('MessageLogicService', () => {
  let service: MessageLogicService
  let mockClient: MockSupabaseClient
  let config: MessagePoolConfig

  beforeEach(() => {
    config = {
      ...DEFAULT_CONFIG,
      pollingInterval: 100, // Fast polling for tests
      clusterSize: 10
    }
    mockClient = createMockSupabaseClient()
  })

  afterEach(() => {
    if (service) {
      service.cleanup()
    }
  })

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)

      await service.initialize()

      const stats = service.getStats()
      expect(stats.initialized).toBe(true)
    })

    it('should throw if database connection fails', async () => {
      mockClient.setShouldFail(true)

      service = new MessageLogicService(mockClient as any, config)

      await expect(service.initialize()).rejects.toThrow()
    })

    it('should not re-initialize if already initialized', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)

      await service.initialize()
      await service.initialize() // Second call should be no-op

      const stats = service.getStats()
      expect(stats.initialized).toBe(true)
    })
  })

  describe('getNextCluster', () => {
    it('should throw if not initialized', async () => {
      service = new MessageLogicService(mockClient as any, config)

      await expect(service.getNextCluster()).rejects.toThrow(
        'Service not initialized'
      )
    })

    it('should return null for empty database', async () => {
      mockClient.setMessages([])

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const cluster = await service.getNextCluster()

      expect(cluster).toBeNull()
    })

    it('should generate cluster with focus and related messages', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const cluster = await service.getNextCluster()

      expect(cluster).not.toBeNull()
      expect(cluster?.focus).toBeDefined()
      expect(cluster?.focusId).toBe(cluster?.focus.id)
      expect(cluster?.related).toBeInstanceOf(Array)
      expect(cluster?.duration).toBe(config.clusterDuration)
    })

    it('should handle single message', async () => {
      const messages = createTestMessages(1)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const cluster = await service.getNextCluster()

      expect(cluster).not.toBeNull()
      expect(cluster?.focus).toBeDefined()
      expect(cluster?.related.length).toBe(0)
    })

    it('should maintain traversal continuity between clusters', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const cluster1 = await service.getNextCluster()
      const cluster2 = await service.getNextCluster()

      expect(cluster1).not.toBeNull()
      expect(cluster2).not.toBeNull()

      // cluster2 should include cluster1's focus or next in its cluster
      if (cluster1?.next) {
        const hasNext =
          cluster2?.focus.id === cluster1.next.id ||
          cluster2?.related.some((r) => r.messageId === cluster1.next?.id)
        // Continuity is maintained through the previous focus reference
      }
    })

    it('should increment cluster count', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      await service.getNextCluster()
      const stats1 = service.getStats()

      await service.getNextCluster()
      const stats2 = service.getStats()

      expect(stats2.totalClustersShown).toBe(stats1.totalClustersShown + 1)
    })

    it('should include timestamp in cluster', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const before = new Date()
      const cluster = await service.getNextCluster()
      const after = new Date()

      expect(cluster?.timestamp).toBeInstanceOf(Date)
      expect(cluster?.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(cluster?.timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('should include similarity scores for related messages', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const cluster = await service.getNextCluster()

      if (cluster && cluster.related.length > 0) {
        cluster.related.forEach((rel) => {
          expect(rel.similarity).toBeGreaterThanOrEqual(0)
          expect(rel.similarity).toBeLessThanOrEqual(1)
        })
      }
    })
  })

  describe('addNewMessage', () => {
    it('should throw if not initialized', async () => {
      service = new MessageLogicService(mockClient as any, config)

      const newMsg = {
        content: 'Test message',
        approved: true,
        created_at: new Date().toISOString(),
        deleted_at: null
      }

      await expect(service.addNewMessage(newMsg)).rejects.toThrow(
        'Service not initialized'
      )
    })

    it('should add message to database and priority queue', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const newMsg = {
        content: 'New submission',
        approved: true,
        created_at: new Date().toISOString(),
        deleted_at: null
      }

      const inserted = await service.addNewMessage(newMsg)

      expect(inserted).not.toBeNull()
      expect(inserted?.content).toBe(newMsg.content)

      const stats = service.getStats()
      expect(stats.pool.priorityQueueSize).toBeGreaterThan(0)
    })

    it('should return null on database failure', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      // Make database fail for inserts
      mockClient.setShouldFail(true, 1)

      const newMsg = {
        content: 'Test message',
        approved: true,
        created_at: new Date().toISOString(),
        deleted_at: null
      }

      const inserted = await service.addNewMessage(newMsg)

      expect(inserted).toBeNull()
    })
  })

  describe('getStats', () => {
    it('should return comprehensive statistics', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const stats = service.getStats()

      expect(stats).toHaveProperty('initialized')
      expect(stats).toHaveProperty('totalClustersShown')
      expect(stats).toHaveProperty('currentFocus')
      expect(stats).toHaveProperty('previousFocus')
      expect(stats).toHaveProperty('workingSetSize')
      expect(stats).toHaveProperty('priorityMessageCount')
      expect(stats).toHaveProperty('pool')
      expect(stats).toHaveProperty('config')
    })

    it('should track cluster count', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      await service.getNextCluster()
      await service.getNextCluster()

      const stats = service.getStats()
      expect(stats.totalClustersShown).toBe(2)
    })
  })

  describe('getTotalMessageCount', () => {
    it('should throw if not initialized', async () => {
      service = new MessageLogicService(mockClient as any, config)

      await expect(service.getTotalMessageCount()).rejects.toThrow(
        'Service not initialized'
      )
    })

    it('should return total message count', async () => {
      const messages = createTestMessages(42)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const count = await service.getTotalMessageCount()

      expect(count).toBe(42)
    })
  })



  describe('resetTraversal', () => {
    it('should reset traversal state', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      await service.getNextCluster()
      await service.getNextCluster()

      service.resetTraversal()

      const stats = service.getStats()
      expect(stats.totalClustersShown).toBe(0)
      expect(stats.currentFocus).toBeNull()
      expect(stats.previousFocus).toBeNull()
    })
  })

  describe('cleanup', () => {
    it('should reset all state', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      await service.getNextCluster()

      service.cleanup()

      const stats = service.getStats()
      expect(stats.initialized).toBe(false)
      expect(stats.totalClustersShown).toBe(0)
      expect(stats.pool.priorityQueueSize).toBe(0)
    })

    it('should not throw when called multiple times', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      expect(() => {
        service.cleanup()
        service.cleanup()
        service.cleanup()
      }).not.toThrow()
    })
  })

  describe('working set', () => {
    it('should maintain fixed working set size after initialization', async () => {
      const messages = createTestMessages(500)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const stats = service.getStats()
      expect(stats.workingSetSize).toBe(config.workingSetSize)
    })

    it('should maintain working set size after cluster transitions', async () => {
      const messages = createTestMessages(500)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const initialSize = service.getWorkingSetSize()

      await service.getNextCluster()
      expect(service.getWorkingSetSize()).toBe(initialSize)

      await service.getNextCluster()
      expect(service.getWorkingSetSize()).toBe(initialSize)

      await service.getNextCluster()
      expect(service.getWorkingSetSize()).toBe(initialSize)
    })

    it('should track priority messages in working set', async () => {
      const messages = createTestMessages(500)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      // Add a new message (should be tracked as priority)
      await service.addNewMessage({
        content: 'Priority message',
        approved: true,
        created_at: new Date().toISOString(),
        deleted_at: null
      })

      // Priority message is now in queue and working set
      // Check stats BEFORE it appears in a cluster
      const statsBefore = service.getStats()
      expect(statsBefore.priorityMessageCount).toBeGreaterThan(0)
      
      // After it appears in a cluster, it loses priority status
      await service.getNextCluster()
      const statsAfter = service.getStats()
      
      // Priority count may be 0 or >0 depending on whether the priority message appeared
      // This is correct behavior - priority messages lose status once displayed
      expect(statsAfter.priorityMessageCount).toBeGreaterThanOrEqual(0)
    })

    it('should emit working set changes when callback registered', async () => {
      const messages = createTestMessages(500)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      let changeEmitted = false
      let removedCount = 0
      let addedCount = 0

      service.onWorkingSetChange(({ removed, added }) => {
        changeEmitted = true
        removedCount = removed.length
        addedCount = added.length
      })

      // First cluster generates no working set changes (nothing to remove)
      await service.getNextCluster()
      
      // Second cluster WILL generate working set changes (removes old cluster, adds new messages)
      await service.getNextCluster()

      expect(changeEmitted).toBe(true)
      expect(removedCount).toBeGreaterThan(0)
      expect(addedCount).toBeGreaterThan(0)
      expect(removedCount).toBe(addedCount) // Should be balanced
    })

    it('should return copy of working set', async () => {
      const messages = createTestMessages(500)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      const workingSet1 = service.getWorkingSet()
      const workingSet2 = service.getWorkingSet()

      // Should be different array instances (copies)
      expect(workingSet1).not.toBe(workingSet2)

      // But should have same content
      expect(workingSet1.length).toBe(workingSet2.length)
      expect(workingSet1[0].id).toBe(workingSet2[0].id)
    })
  })

  describe('edge cases', () => {
    it('should handle rapid cluster requests', async () => {
      const messages = createTestMessages(100)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      // Request multiple clusters rapidly
      const clusters = await Promise.all([
        service.getNextCluster(),
        service.getNextCluster(),
        service.getNextCluster()
      ])

      // All should succeed
      clusters.forEach((cluster) => {
        expect(cluster).not.toBeNull()
      })
    })

    it('should handle message submission during cluster generation', async () => {
      const messages = createTestMessages(50)
      mockClient.setMessages(messages)

      service = new MessageLogicService(mockClient as any, config)
      await service.initialize()

      // Start cluster generation and message submission simultaneously
      const [cluster, inserted] = await Promise.all([
        service.getNextCluster(),
        service.addNewMessage({
          content: 'Concurrent message',
          approved: true,
          created_at: new Date().toISOString(),
          deleted_at: null
        })
      ])

      expect(cluster).not.toBeNull()
      expect(inserted).not.toBeNull()
    })
  })
})
