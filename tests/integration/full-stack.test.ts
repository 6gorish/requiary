/**
 * Integration Tests: Full Stack
 * 
 * Tests the complete system with real Supabase connection
 * NOTE: Requires valid .env.local with Supabase credentials
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { MessageLogicService } from '@/lib/services/message-logic-service'
import { loadConfig } from '@/lib/config/message-pool-config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Skip these tests if Supabase credentials not available
const shouldSkip = !SUPABASE_URL || !SUPABASE_ANON_KEY

describe.skipIf(shouldSkip)('Integration: Full Stack with Real Supabase', () => {
  let service: MessageLogicService
  let supabase: ReturnType<typeof createClient<Database>>
  
  beforeAll(async () => {
    // Create real Supabase client
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Load production config
    const config = loadConfig()
    
    // Initialize service
    service = new MessageLogicService(supabase, config)
    await service.initialize()
  })
  
  afterAll(async () => {
    // Cleanup
    service.cleanup()
  })

  test('should connect to Supabase and initialize', async () => {
    expect(service).toBeDefined()
    
    const stats = service.getStats()
    expect(stats).toBeDefined()
    expect(stats.pool).toBeDefined()
  })

  test('should retrieve clusters from real database', async () => {
    const cluster = await service.getNextCluster()
    
    // May be null if database is empty
    if (cluster) {
      expect(cluster.focus).toBeDefined()
      expect(cluster.focus.id).toBeDefined()
      expect(cluster.focus.content).toBeDefined()
      expect(cluster.related).toBeInstanceOf(Array)
      expect(cluster.duration).toBeGreaterThan(0)
      expect(cluster.timestamp).toBeInstanceOf(Date)
    } else {
      console.warn('⚠️  Database appears empty - no clusters available')
    }
  })

  test('should handle message submission end-to-end', async () => {
    const testMessage = {
      content: `Integration test message ${Date.now()}`,
      approved: true,
      created_at: new Date().toISOString(),
      deleted_at: null,
    }
    
    const submitted = await service.addNewMessage(testMessage)
    
    expect(submitted).toBeDefined()
    expect(submitted.id).toBeDefined()
    expect(submitted.content).toBe(testMessage.content)
    
    // Verify it appears in stats
    const stats = service.getStats()
    expect(stats.pool.priorityQueueSize).toBeGreaterThan(0)
  })

  test('should maintain traversal continuity across multiple clusters', async () => {
    const cluster1 = await service.getNextCluster()
    if (!cluster1) {
      console.warn('⚠️  Skipping continuity test - no clusters available')
      return
    }
    
    const cluster2 = await service.getNextCluster()
    if (!cluster2) {
      console.warn('⚠️  Skipping continuity test - only one cluster available')
      return
    }
    
    // Cluster 2 should include cluster 1's focus in its related messages
    const previousFocusInRelated = cluster2.related.some(
      r => r.messageId === cluster1.focus.id
    )
    
    expect(previousFocusInRelated).toBe(true)
  })

  test('should handle database query errors gracefully', async () => {
    // Create a service with invalid credentials
    const badSupabase = createClient('https://invalid.supabase.co', 'invalid-key')
    const badService = new MessageLogicService(badSupabase, loadConfig())
    
    // Should throw or handle gracefully
    await expect(badService.initialize()).rejects.toThrow()
  })

  test('should respect configuration parameters', async () => {
    const customConfig = loadConfig()
    customConfig.workingSetSize = 100 // Smaller than default
    
    const customService = new MessageLogicService(supabase, customConfig)
    await customService.initialize()
    
    const stats = customService.getStats()
    expect(stats.config.workingSetSize).toBeLessThanOrEqual(100)
    
    customService.cleanup()
  })
})

describe.skipIf(shouldSkip)('Integration: Database Service Direct Tests', () => {
  let supabase: ReturnType<typeof createClient<Database>>
  
  beforeAll(() => {
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  })

  test('should fetch messages with cursor pagination', async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('approved', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    if (data && data.length > 0) {
      expect(data[0]).toHaveProperty('id')
      expect(data[0]).toHaveProperty('content')
      expect(data[0]).toHaveProperty('created_at')
    }
  })

  test('should insert new messages', async () => {
    const testMessage = {
      content: `DB test message ${Date.now()}`,
      approved: true,
    }
    
    const { data, error } = await supabase
      .from('messages')
      .insert(testMessage)
      .select()
      .single()
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data?.content).toBe(testMessage.content)
  })
})
