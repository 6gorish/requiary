/**
 * Message Pool Manager Tests
 *
 * Unit tests for MessagePoolManager service.
 * Tests dual-cursor algorithm, surge mode, and priority queue management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MessagePoolManager, type BatchResult } from '@/lib/services/message-pool-manager'
import type { MessagePoolConfig } from '@/types/grief-messages'
import {
  MockDatabaseService,
  createTestMessages,
  createTestMessage
} from '../mocks/database-service'
import { DEFAULT_CONFIG } from '@/lib/config/message-pool-config'

describe('MessagePoolManager', () => {
  let poolManager: MessagePoolManager
  let mockDb: MockDatabaseService
  let config: MessagePoolConfig

  beforeEach(() => {
    config = {
      ...DEFAULT_CONFIG,
      pollingInterval: 100 // Fast polling for tests
    }
    mockDb = new MockDatabaseService()
    poolManager = new MessagePoolManager(mockDb as any, config)
  })

  afterEach(() => {
    poolManager.cleanup()
  })

  describe('initialize', () => {
    it('should initialize with empty database', async () => {
      mockDb.setMessages([])

      await poolManager.initialize()

      const stats = poolManager.getStats()
      expect(stats.historicalCursor).toBeNull()
      expect(stats.newMessageWatermark).toBe(0)
    })

    it('should initialize cursors to max ID', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)

      await poolManager.initialize()

      const stats = poolManager.getStats()
      expect(stats.historicalCursor).toBe(100)
      expect(stats.newMessageWatermark).toBe(100)
    })

    it('should throw on database error', async () => {
      mockDb.setShouldFail(true)

      await expect(poolManager.initialize()).rejects.toThrow()
    })
  })

  describe('getNextBatch', () => {
    it('should fetch historical messages in normal mode', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      const batch = await poolManager.getNextBatch(20)

      expect(batch.messages.length).toBe(20)
      expect(batch.messages.every((msg) => msg.approved)).toBe(true)
      expect(batch.priorityIds.length).toBe(0) // No priority messages
    })

    it('should return empty array when database is empty', async () => {
      mockDb.setMessages([])
      await poolManager.initialize()

      const batch = await poolManager.getNextBatch(20)

      expect(batch.messages.length).toBe(0)
      expect(batch.priorityIds.length).toBe(0)
    })

    it('should handle batch size larger than available messages', async () => {
      const messages = createTestMessages(10)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      const batch = await poolManager.getNextBatch(50)

      expect(batch.messages.length).toBeLessThanOrEqual(10)
    })

    it('should drain priority queue first with simplified allocation', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      // Add messages to priority queue
      const newMsg = createTestMessage(101, 'New message')
      await poolManager.addNewMessage(newMsg)

      const batch = await poolManager.getNextBatch(20)

      // Should include message from priority queue
      const hasNewMessage = batch.messages.some((msg) => msg.id === '101')
      expect(hasNewMessage).toBe(true)
      // Should track it as priority
      expect(batch.priorityIds).toContain('101')
    })

    it('should recycle historical cursor when exhausted', async () => {
      const messages = createTestMessages(5)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      // Fetch multiple batches to exhaust cursor
      await poolManager.getNextBatch(3)
      await poolManager.getNextBatch(3)
      const batch3 = await poolManager.getNextBatch(3)

      // Should still get messages (recycled)
      expect(batch3.messages.length).toBeGreaterThan(0)
    })
  })

  describe('addNewMessage', () => {
    it('should add message to priority queue', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      const newMsg = createTestMessage(101, 'New message')
      await poolManager.addNewMessage(newMsg)

      const stats = poolManager.getStats()
      expect(stats.priorityQueueSize).toBe(1)
    })

    it('should update watermark', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      const newMsg = createTestMessage(101, 'New message')
      await poolManager.addNewMessage(newMsg)

      const stats = poolManager.getStats()
      expect(stats.newMessageWatermark).toBe(101)
    })

    it('should handle queue overflow by dropping oldest', async () => {
      const messages = createTestMessages(10)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      // Add more messages than max queue size
      const maxSize = config.priorityQueue.maxSize
      for (let i = 0; i < maxSize + 10; i++) {
        const msg = createTestMessage(100 + i, `Message ${i}`)
        await poolManager.addNewMessage(msg)
      }

      const stats = poolManager.getStats()
      expect(stats.priorityQueueSize).toBeLessThanOrEqual(maxSize)
    })
  })

  describe('simplified allocation (surge mode removed)', () => {
    it('should always return false for isSurgeMode', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      // Add many messages to queue
      for (let i = 0; i < 200; i++) {
        const msg = createTestMessage(200 + i, `Message ${i}`)
        await poolManager.addNewMessage(msg)
      }

      // Surge mode is deprecated and always false
      expect(poolManager.isSurgeMode()).toBe(false)
    })

    it('should drain priority queue completely before historical', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      // Add 10 messages to priority queue
      for (let i = 0; i < 10; i++) {
        const msg = createTestMessage(200 + i, `Priority message ${i}`)
        await poolManager.addNewMessage(msg)
      }

      const batch = await poolManager.getNextBatch(20)

      // Should take all 10 from priority queue first
      const priorityCount = batch.messages.filter((msg) => parseInt(msg.id) >= 200).length
      expect(priorityCount).toBe(10)
      expect(batch.priorityIds.length).toBe(10)
      
      // Remaining 10 should be historical
      expect(batch.messages.length).toBe(20)
    })

    it('should take all from priority queue when it has enough', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      // Add 30 messages to priority queue (more than needed)
      for (let i = 0; i < 30; i++) {
        const msg = createTestMessage(200 + i, `Priority message ${i}`)
        await poolManager.addNewMessage(msg)
      }

      const batch = await poolManager.getNextBatch(20)

      // Should take all 20 from priority queue
      const priorityCount = batch.messages.filter((msg) => parseInt(msg.id) >= 200).length
      expect(priorityCount).toBe(20)
      expect(batch.priorityIds.length).toBe(20)
      expect(batch.messages.length).toBe(20)
    })

    it('should use only historical when queue is empty', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      const batch = await poolManager.getNextBatch(20)

      // No priority messages
      expect(batch.priorityIds.length).toBe(0)
      // All historical
      expect(batch.messages.length).toBe(20)
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      const stats = poolManager.getStats()

      expect(stats).toHaveProperty('historicalCursor')
      expect(stats).toHaveProperty('newMessageWatermark')
      expect(stats).toHaveProperty('priorityQueueSize')
      expect(stats).toHaveProperty('surgeMode')
      expect(stats).toHaveProperty('queueWaitTime')
      expect(stats).toHaveProperty('memoryUsage')
    })

    it('should calculate queue wait time', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      // Add messages to queue
      for (let i = 0; i < 50; i++) {
        const msg = createTestMessage(200 + i, `Message ${i}`)
        await poolManager.addNewMessage(msg)
      }

      const stats = poolManager.getStats()

      expect(stats.queueWaitTime).toBeGreaterThan(0)
    })
  })

  describe('getClusterConfig', () => {
    it('should return cluster configuration', () => {
      const clusterConfig = poolManager.getClusterConfig()

      expect(clusterConfig.slots).toBe(config.clusterSize)
      expect(clusterConfig.duration).toBe(config.clusterDuration)
    })
  })

  describe('cleanup', () => {
    it('should clear priority queue', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      // Add messages to queue
      const msg = createTestMessage(101, 'New message')
      await poolManager.addNewMessage(msg)

      poolManager.cleanup()

      const stats = poolManager.getStats()
      expect(stats.priorityQueueSize).toBe(0)
    })

    it('should stop polling', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      // Polling should be active
      const statsBefore = poolManager.getStats()

      poolManager.cleanup()

      // After cleanup, polling should be stopped
      // We can't directly test this, but cleanup should not throw
      expect(() => poolManager.cleanup()).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle single message in database', async () => {
      const messages = createTestMessages(1)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      const batch = await poolManager.getNextBatch(20)

      expect(batch.messages.length).toBe(1)
    })

    it('should handle requesting more messages than exist', async () => {
      const messages = createTestMessages(5)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      const batch = await poolManager.getNextBatch(100)

      expect(batch.messages.length).toBeLessThanOrEqual(5)
    })

    it('should handle watermark higher than all messages', async () => {
      const messages = createTestMessages(100)
      mockDb.setMessages(messages)
      await poolManager.initialize()

      // Manually set watermark very high
      const highMsg = createTestMessage(1000, 'High ID message')
      await poolManager.addNewMessage(highMsg)

      const stats = poolManager.getStats()
      expect(stats.newMessageWatermark).toBe(1000)
    })
  })
})
