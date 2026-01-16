/**
 * Mock Supabase Client
 *
 * Complete mock of Supabase client for testing DatabaseService.
 * Implements the full query chaining API.
 */

import type { GriefMessage } from '@/types/grief-messages'
import type { Message } from '@/types/database'

export class MockSupabaseClient {
  private messages: GriefMessage[] = []
  private shouldFail: boolean = false
  private failureCount: number = 0
  private maxFailures: number = 0

  setMessages(messages: GriefMessage[]): void {
    this.messages = [...messages]
  }

  setShouldFail(shouldFail: boolean, maxFailures: number = 0): void {
    this.shouldFail = shouldFail
    this.maxFailures = maxFailures
    this.failureCount = 0
  }

  from(table: string) {
    return new MockTableQuery(this.messages, this.shouldFail, () => {
      if (this.shouldFail) {
        if (this.maxFailures === 0 || this.failureCount < this.maxFailures) {
          this.failureCount++
          return true
        }
        this.shouldFail = false
      }
      return false
    })
  }
}

class MockTableQuery {
  private data: GriefMessage[]
  private filters: Array<(msg: GriefMessage) => boolean> = []
  private limitCount?: number
  private orderField?: string
  private orderAsc?: boolean
  private isInsert: boolean = false
  private insertData?: any
  private shouldFailFn: () => boolean

  constructor(messages: GriefMessage[], shouldFail: boolean, shouldFailFn: () => boolean) {
    this.data = messages  // Use reference, not copy
    this.shouldFailFn = shouldFailFn
  }

  select(columns?: string, options?: any) {
    // Check for count query
    if (options?.count === 'exact' && options?.head === true) {
      return this
    }
    return this
  }

  eq(column: string, value: any) {
    this.filters.push((msg: any) => {
      if (column === 'approved') return msg.approved === value
      return true
    })
    return this
  }

  is(column: string, value: any) {
    this.filters.push((msg: any) => {
      if (column === 'deleted_at') return msg.deleted_at === value
      return true
    })
    return this
  }

  gt(column: string, value: any) {
    this.filters.push((msg: any) => {
      if (column === 'id') return parseInt(msg.id, 10) > parseInt(value, 10)
      return true
    })
    return this
  }

  gte(column: string, value: any) {
    this.filters.push((msg: any) => {
      if (column === 'id') return parseInt(msg.id, 10) >= parseInt(value, 10)
      return true
    })
    return this
  }

  lte(column: string, value: any) {
    this.filters.push((msg: any) => {
      if (column === 'id') return parseInt(msg.id, 10) <= parseInt(value, 10)
      return true
    })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  order(field: string, options?: { ascending: boolean }) {
    this.orderField = field
    this.orderAsc = options?.ascending ?? true
    return this
  }

  insert(data: any) {
    this.isInsert = true
    this.insertData = data
    return this
  }

  async single() {
    if (this.shouldFailFn()) {
      return { data: null, error: { message: 'Mock database error' } }
    }

    if (this.isInsert) {
      // Generate ID for insert
      const maxId = this.data.length > 0
        ? Math.max(...this.data.map(m => parseInt(m.id, 10)))
        : 0

      const newMessage: Message = {
        id: (maxId + 1).toString(),
        content: this.insertData.content,
        created_at: this.insertData.created_at || new Date().toISOString(),
        approved: this.insertData.approved ?? true,
        deleted_at: this.insertData.deleted_at || null
      }

      this.data.push(newMessage as GriefMessage)

      return { data: newMessage, error: null }
    }

    // Apply filters
    let filtered = this.applyFilters()

    // Apply ordering
    if (this.orderField) {
      filtered = this.applyOrdering(filtered)
    }

    // Get first item
    return { data: filtered[0] || null, error: null }
  }

  async then(resolve: any) {
    if (this.shouldFailFn()) {
      return resolve({ data: null, error: { message: 'Mock database error' }, count: null })
    }

    if (this.isInsert) {
      return this.single().then(resolve)
    }

    // Apply filters
    let filtered = this.applyFilters()

    // Check for count query (head: true means count only)
    const isCountQuery = this.limitCount === undefined

    // Apply ordering
    if (this.orderField) {
      filtered = this.applyOrdering(filtered)
    }

    // Apply limit
    if (this.limitCount) {
      filtered = filtered.slice(0, this.limitCount)
    }

    // Convert to database format
    const data = filtered.map(msg => ({
      id: msg.id,
      content: msg.content,
      created_at: msg.created_at,
      approved: msg.approved,
      deleted_at: msg.deleted_at
    }))

    return resolve({
      data: isCountQuery ? null : data,
      error: null,
      count: filtered.length
    })
  }

  private applyFilters(): GriefMessage[] {
    return this.data.filter(msg => {
      return this.filters.every(filter => filter(msg))
    })
  }

  private applyOrdering(messages: GriefMessage[]): GriefMessage[] {
    const sorted = [...messages]

    if (this.orderField === 'id') {
      sorted.sort((a, b) => {
        const aId = parseInt(a.id, 10)
        const bId = parseInt(b.id, 10)
        return this.orderAsc ? aId - bId : bId - aId
      })
    }

    return sorted
  }
}

export function createMockSupabaseClient(): MockSupabaseClient {
  return new MockSupabaseClient()
}

// Export type for use in tests
export type { MockSupabaseClient }
