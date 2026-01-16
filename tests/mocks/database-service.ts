/**
 * Mock Database Service
 *
 * Test double for DatabaseService.
 * Provides controllable behavior for unit testing.
 */

import type { GriefMessage } from '@/types/grief-messages'

/**
 * Mock Database Service Class
 *
 * Simulates DatabaseService without requiring Supabase connection.
 * Stores messages in memory for testing.
 */
export class MockDatabaseService {
  private messages: GriefMessage[] = []
  private shouldFail: boolean = false
  private failureCount: number = 0
  private maxFailures: number = 0

  /**
   * Set Messages
   *
   * Loads messages into the mock database.
   *
   * @param messages - Messages to load
   */
  setMessages(messages: GriefMessage[]): void {
    this.messages = [...messages].sort(
      (a, b) => parseInt(a.id, 10) - parseInt(b.id, 10)
    )
  }

  /**
   * Set Should Fail
   *
   * Configures the mock to fail for testing error handling.
   *
   * @param shouldFail - Whether operations should fail
   * @param maxFailures - Number of times to fail before succeeding (0 = fail forever)
   */
  setShouldFail(shouldFail: boolean, maxFailures: number = 0): void {
    this.shouldFail = shouldFail
    this.maxFailures = maxFailures
    this.failureCount = 0
  }

  /**
   * Fetch Batch with Cursor
   *
   * Mock implementation of cursor-based pagination.
   */
  async fetchBatchWithCursor(
    cursor: number,
    limit: number,
    direction: 'ASC' | 'DESC',
    maxId?: number
  ): Promise<GriefMessage[]> {
    if (this.shouldFail) {
      if (this.maxFailures === 0 || this.failureCount < this.maxFailures) {
        this.failureCount++
        throw new Error('Mock database error')
      }
      // Reset failure state after max failures reached
      this.shouldFail = false
    }

    let filtered = this.messages.filter((msg) => msg.approved && !msg.deleted_at)

    if (direction === 'DESC') {
      // Historical: id <= cursor
      filtered = filtered.filter((msg) => parseInt(msg.id, 10) <= cursor)

      if (maxId !== undefined) {
        filtered = filtered.filter((msg) => parseInt(msg.id, 10) <= maxId)
      }

      // Sort DESC
      filtered.sort((a, b) => parseInt(b.id, 10) - parseInt(a.id, 10))
    } else {
      // New messages: id >= cursor
      filtered = filtered.filter((msg) => parseInt(msg.id, 10) >= cursor)

      // Sort ASC
      filtered.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10))
    }

    return filtered.slice(0, limit)
  }

  /**
   * Fetch New Messages Above Watermark
   *
   * Mock implementation of new message polling.
   */
  async fetchNewMessagesAboveWatermark(watermark: number): Promise<GriefMessage[]> {
    if (this.shouldFail) {
      if (this.maxFailures === 0 || this.failureCount < this.maxFailures) {
        this.failureCount++
        throw new Error('Mock database error')
      }
      this.shouldFail = false
    }

    const filtered = this.messages
      .filter((msg) => msg.approved && !msg.deleted_at)
      .filter((msg) => parseInt(msg.id, 10) > watermark)
      .sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10))

    return filtered
  }

  /**
   * Get Max Message ID
   *
   * Mock implementation of max ID query.
   */
  async getMaxMessageId(): Promise<number> {
    if (this.shouldFail) {
      if (this.maxFailures === 0 || this.failureCount < this.maxFailures) {
        this.failureCount++
        throw new Error('Mock database error')
      }
      this.shouldFail = false
    }

    const approved = this.messages.filter((msg) => msg.approved && !msg.deleted_at)

    if (approved.length === 0) {
      return 0
    }

    const ids = approved.map((msg) => parseInt(msg.id, 10))
    return Math.max(...ids)
  }

  /**
   * Add Message
   *
   * Mock implementation of message insertion.
   */
  async addMessage(message: Omit<GriefMessage, 'id'>): Promise<GriefMessage | null> {
    if (this.shouldFail) {
      if (this.maxFailures === 0 || this.failureCount < this.maxFailures) {
        this.failureCount++
        return null
      }
      this.shouldFail = false
    }

    // Generate new ID
    const maxId = this.messages.length > 0
      ? Math.max(...this.messages.map((msg) => parseInt(msg.id, 10)))
      : 0

    const newMessage: GriefMessage = {
      ...message,
      id: (maxId + 1).toString()
    }

    this.messages.push(newMessage)

    return newMessage
  }

  /**
   * Get Message Count
   *
   * Mock implementation of message count query.
   */
  async getMessageCount(): Promise<number> {
    if (this.shouldFail) {
      if (this.maxFailures === 0 || this.failureCount < this.maxFailures) {
        this.failureCount++
        throw new Error('Mock database error')
      }
      this.shouldFail = false
    }

    return this.messages.filter((msg) => msg.approved && !msg.deleted_at).length
  }

  /**
   * Test Connection
   *
   * Mock implementation of connection test.
   */
  async testConnection(): Promise<boolean> {
    if (this.shouldFail) {
      return false
    }

    return true
  }

  /**
   * Cleanup
   *
   * Mock implementation of cleanup.
   */
  cleanup(): void {
    // No-op for mock
  }

  /**
   * Get All Messages
   *
   * Test helper to inspect mock state.
   */
  getAllMessages(): GriefMessage[] {
    return [...this.messages]
  }

  /**
   * Clear Messages
   *
   * Test helper to reset mock state.
   */
  clearMessages(): void {
    this.messages = []
  }
}

/**
 * Create Test Messages
 *
 * Helper function to generate test messages.
 *
 * @param count - Number of messages to create
 * @param startId - Starting ID (default 1)
 * @returns Array of test messages
 */
export function createTestMessages(count: number, startId: number = 1): GriefMessage[] {
  const messages: GriefMessage[] = []
  const baseTime = new Date('2024-01-01T00:00:00Z').getTime()

  for (let i = 0; i < count; i++) {
    const id = startId + i
    const timestamp = new Date(baseTime + i * 60000) // 1 minute apart

    messages.push({
      id: id.toString(),
      content: `Test message ${id}`,
      created_at: timestamp.toISOString(),
      approved: true,
      deleted_at: null
    })
  }

  return messages
}

/**
 * Create Test Message
 *
 * Helper to create a single test message.
 *
 * @param id - Message ID
 * @param content - Message content
 * @param timestamp - Optional timestamp
 * @returns Test message
 */
export function createTestMessage(
  id: number,
  content: string,
  timestamp?: Date
): GriefMessage {
  return {
    id: id.toString(),
    content,
    created_at: timestamp?.toISOString() || new Date().toISOString(),
    approved: true,
    deleted_at: null
  }
}
