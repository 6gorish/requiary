/**
 * Database Service
 *
 * Abstraction layer for Supabase database operations.
 * Handles message queries, cursor pagination, and error recovery.
 *
 * IMPORTANT: This service only deals with data - NO visualization concepts.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Message } from '@/types/database'
import type { GriefMessage } from '@/types/grief-messages'
import { toGriefMessage } from '@/types/grief-messages'

/**
 * Database Service Class
 *
 * Wraps Supabase client with typed message operations.
 * Provides dual-cursor pagination and new message polling.
 */
export class DatabaseService {
  private client: SupabaseClient<Database>
  private retryDelay: number = 1000 // Start at 1 second
  private maxRetryDelay: number = 30000 // Max 30 seconds

  constructor(client: SupabaseClient<Database>) {
    this.client = client
  }

  /**
   * Fetch Batch with Cursor
   *
   * Retrieves messages using cursor-based pagination.
   * Supports both ascending (new messages) and descending (historical) order.
   *
   * @param cursor - Starting message ID
   * @param limit - Maximum messages to fetch
   * @param direction - Sort direction ('ASC' | 'DESC')
   * @param maxId - Optional upper bound (for historical cursor)
   * @returns Array of grief messages
   *
   * @example
   * // Historical (backwards traversal)
   * const historical = await db.fetchBatchWithCursor(1000, 20, 'DESC', 950)
   *
   * // New messages (forwards)
   * const newMsgs = await db.fetchBatchWithCursor(1000, 10, 'ASC')
   */
  async fetchBatchWithCursor(
    cursor: number,
    limit: number,
    direction: 'ASC' | 'DESC',
    maxId?: number
  ): Promise<GriefMessage[]> {
    try {
      let query = this.client
        .from('messages')
        .select('id, content, created_at, approved, deleted_at')
        .eq('approved', true)
        .is('deleted_at', null)
        .limit(limit)

      // Apply cursor constraint based on direction
      if (direction === 'DESC') {
        // Historical: id <= cursor
        query = query.lte('id', cursor.toString())

        // Optional: cap at maxId (don't overlap with new watermark)
        if (maxId !== undefined) {
          query = query.lte('id', maxId.toString())
        }

        query = query.order('id', { ascending: false })
      } else {
        // New messages: id >= cursor
        query = query.gte('id', cursor.toString())
        query = query.order('id', { ascending: true })
      }

      const { data, error } = await query

      if (error) {
        throw new Error(`Database query failed: ${error.message}`)
      }

      if (!data) {
        return []
      }

      // Convert to GriefMessage format
      const messages = data.map(toGriefMessage)

      // Reset retry delay on success
      this.retryDelay = 1000

      return messages
    } catch (error) {
      return await this.handleQueryError(
        error,
        'fetchBatchWithCursor',
        () => this.fetchBatchWithCursor(cursor, limit, direction, maxId)
      )
    }
  }

  /**
   * Fetch New Messages Above Watermark
   *
   * Retrieves all approved messages with ID > watermark.
   * Used by new message polling system.
   *
   * @param watermark - Highest message ID seen
   * @returns Array of new grief messages
   *
   * @example
   * const newMessages = await db.fetchNewMessagesAboveWatermark(12345)
   * console.log(`Found ${newMessages.length} new messages`)
   */
  async fetchNewMessagesAboveWatermark(
    watermark: number
  ): Promise<GriefMessage[]> {
    try {
      const { data, error} = await this.client
        .from('messages')
        .select('id, content, created_at, approved, deleted_at')
        .eq('approved', true)
        .is('deleted_at', null)
        .gt('id', watermark.toString())
        .order('id', { ascending: true })

      if (error) {
        throw new Error(`New message query failed: ${error.message}`)
      }

      if (!data) {
        return []
      }

      const messages = data.map(toGriefMessage)

      if (messages.length > 0) {
        // Found new messages (silent)
      }

      // Reset retry delay on success
      this.retryDelay = 1000

      return messages
    } catch (error) {
      return await this.handleQueryError(
        error,
        'fetchNewMessagesAboveWatermark',
        () => this.fetchNewMessagesAboveWatermark(watermark)
      )
    }
  }

  /**
   * Get Max Message ID
   *
   * Returns the highest message ID in the database.
   * Used to initialize dual cursors.
   *
   * @returns Maximum message ID, or 0 if no messages
   *
   * @example
   * const maxId = await db.getMaxMessageId()
   * console.log(`Highest message ID: ${maxId}`)
   */
  async getMaxMessageId(): Promise<number> {
    try {
      const { data, error } = await this.client
        .from('messages')
        .select('id')
        .eq('approved', true)
        .is('deleted_at', null)
        .order('id', { ascending: false })
        .limit(1)

      if (error) {
        throw new Error(`Max ID query failed: ${error.message}`)
      }

      if (!data || data.length === 0) {
        return 0
      }

      // Type assertion for query result
      const maxId = parseInt((data[0] as { id: string }).id, 10)

      // Reset retry delay on success
      this.retryDelay = 1000

      return maxId
    } catch (error) {
      return await this.handleQueryError(error, 'getMaxMessageId', () =>
        this.getMaxMessageId()
      )
    }
  }

  /**
   * Add Message
   *
   * Inserts a new grief message into the database.
   * Used for testing or manual message injection.
   *
   * @param message - Message to insert (without ID)
   * @returns Inserted message with ID, or null on failure
   *
   * @example
   * const newMsg = await db.addMessage({
   *   content: "Testing message",
   *   approved: true,
   *   created_at: new Date().toISOString(),
   *   deleted_at: null
   * })
   */
  async addMessage(
    message: Omit<GriefMessage, 'id'>
  ): Promise<GriefMessage | null> {
    try {
      const { data, error } = await (this.client
        .from('messages') as any)
        .insert({
          content: message.content,
          approved: message.approved,
          created_at: message.created_at,
          deleted_at: message.deleted_at
        })
        .select('id, content, created_at, approved, deleted_at')
        .single()

      if (error) {
        throw new Error(`Message insert failed: ${error.message}`)
      }

      if (!data) {
        return null
      }

      const griefMessage = toGriefMessage(data)

      // Reset retry delay on success
      this.retryDelay = 1000

      return griefMessage
    } catch (error) {
      // Don't retry inserts - return null
      return null
    }
  }

  /**
   * Get Message Count
   *
   * Returns total count of approved, non-deleted messages.
   * Useful for statistics and health checks.
   *
   * @returns Total message count
   */
  async getMessageCount(): Promise<number> {
    try {
      const { count, error } = await this.client
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('approved', true)
        .is('deleted_at', null)

      if (error) {
        throw new Error(`Count query failed: ${error.message}`)
      }

      const totalCount = count || 0

      // Reset retry delay on success
      this.retryDelay = 1000

      return totalCount
    } catch (error) {
      return await this.handleQueryError(error, 'getMessageCount', () =>
        this.getMessageCount()
      )
    }
  }

  /**
   * Test Connection
   *
   * Verifies database connectivity.
   * Used for health checks.
   *
   * @returns True if connection successful
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('messages')
        .select('id')
        .limit(1)

      if (error) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Handle Query Error
   *
   * Implements exponential backoff retry logic.
   * Prevents service from crashing on temporary database issues.
   *
   * @param error - Original error
   * @param operation - Operation name for logging
   * @param retryFn - Function to retry
   * @returns Result from retry, or empty array on failure
   */
  private async handleQueryError<T>(
    error: any,
    operation: string,
    retryFn: () => Promise<T>
  ): Promise<T> {
    // Check if we should retry
    if (this.retryDelay >= this.maxRetryDelay) {
      // Return empty result (type-safe default)
      return ([] as any) as T
    }

    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, this.retryDelay))

    // Exponential backoff: double delay
    this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetryDelay)

    // Retry operation
    try {
      return await retryFn()
    } catch (retryError) {
      // Recursive retry
      return await this.handleQueryError(retryError, operation, retryFn)
    }
  }

  /**
   * Cleanup
   *
   * Releases any resources.
   * Currently no-op, but reserved for future connection pooling.
   */
  cleanup(): void {
    // Future: Close connection pool if needed
  }
}
