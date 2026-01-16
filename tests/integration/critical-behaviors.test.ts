/**
 * Critical Behavior Tests
 * 
 * Tests for essential exhibition behaviors that MUST work:
 * 1. Infinite traversal (cursor recycling)
 * 2. New messages "cutting in line" (priority queue)
 * 3. Traversal continuity at recycling boundary
 * 
 * These tests use REAL Supabase to verify production behavior.
 * Database currently has 597 messages.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { MessageLogicService } from '@/lib/services/message-logic-service'
import { loadConfig } from '@/lib/config/message-pool-config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Skip if credentials not available
const shouldSkip = !SUPABASE_URL || !SUPABASE_ANON_KEY

describe.skipIf(shouldSkip)('Critical Behavior: Infinite Traversal', () => {
  let service: MessageLogicService
  let supabase: ReturnType<typeof createClient<Database>>
  
  beforeAll(async () => {
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Use large working set to ensure broad traversal coverage
    const config = loadConfig()
    config.workingSetSize = 200  // Large size for comprehensive testing
    
    service = new MessageLogicService(supabase, config)
    await service.initialize()
  })
  
  afterAll(() => {
    service.cleanup()
  })

  test('should recycle cursor when reaching oldest message', async () => {
    const totalCount = await service.getTotalMessageCount()
    
    if (totalCount === 0) {
      console.warn('⚠️  Skipping - database is empty')
      return
    }
    
    console.log(`\n📊 Database has ${totalCount} messages (expected ~597)`)
    
    const initialStats = service.getStats()
    const startingCursor = initialStats.pool.historicalCursor
    
    console.log(`🔄 Starting cursor: ${startingCursor}\n`)
    
    let recycleDetected = false
    let batchCount = 0
    const maxBatches = 200
    let previousCursor = startingCursor
    
    for (let i = 0; i < maxBatches; i++) {
      const cluster = await service.getNextCluster()
      
      if (!cluster) {
        throw new Error('Cluster was null - infinite traversal broken!')
      }
      
      batchCount++
      
      const stats = service.getStats()
      const currentCursor = stats.pool.historicalCursor
      
      // Detect recycling: cursor jumped back up (or was null and reset to max)
      if (previousCursor !== null && currentCursor !== null && currentCursor > previousCursor) {
        recycleDetected = true
        console.log(`✅ RECYCLE DETECTED at batch ${batchCount}`)
        console.log(`   Cursor jumped from ${previousCursor} to ${currentCursor}`)
        break
      }
      
      if (i % 10 === 0) {
        console.log(`   Batch ${batchCount}: Cursor at ${currentCursor}`)
      }
      
      previousCursor = currentCursor
    }
    
    expect(recycleDetected).toBe(true)
    expect(batchCount).toBeGreaterThan(0)
  }, 60000) // 60 second timeout

  test('should maintain continuity across recycle boundary', async () => {
    // Reset service to get fresh state
    service.resetTraversal()
    
    const config = loadConfig()
    config.workingSetSize = 200
    
    // Force exhaustion by fetching many clusters
    const clusters = []
    for (let i = 0; i < 50; i++) {
      const cluster = await service.getNextCluster()
      if (cluster) {
        clusters.push(cluster)
      }
    }
    
    expect(clusters.length).toBeGreaterThan(0)
    
    // Check that each cluster (after the first) includes previous focus
    for (let i = 1; i < clusters.length; i++) {
      const prev = clusters[i - 1]
      const curr = clusters[i]
      
      const prevFocusInCurrent = curr.related.some(
        r => r.messageId === prev.focus.id
      )
      
      if (!prevFocusInCurrent) {
        console.error(`❌ CONTINUITY BROKEN at cluster ${i}`)
        console.error(`   Previous focus: ${prev.focus.id}`)
        console.error(`   Current related IDs: ${curr.related.map(r => r.messageId).join(', ')}`)
      }
      
      expect(prevFocusInCurrent).toBe(true)
    }
    
    console.log(`✅ Continuity maintained across ${clusters.length} clusters`)
  }, 60000)
})

describe.skipIf(shouldSkip)('Critical Behavior: Priority Queue', () => {
  let service: MessageLogicService
  let supabase: ReturnType<typeof createClient<Database>>
  
  beforeAll(async () => {
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
    service = new MessageLogicService(supabase, loadConfig())
    await service.initialize()
  })
  
  afterAll(() => {
    service.cleanup()
  })

  test('should make new messages visible within 30 seconds', async () => {
    const testMessage = {
      content: `Test message for priority queue ${Date.now()}`,
      approved: true,
      created_at: new Date().toISOString(),
      deleted_at: null,
    }
    
    console.log('\n📝 Submitting test message...')
    const submitted = await service.addNewMessage(testMessage)
    expect(submitted).toBeDefined()
    expect(submitted!.id).toBeDefined()
    
    const targetId = submitted!.id
    console.log(`   Submitted message ID: ${targetId}`)
    
    const startTime = Date.now()
    const clusterDuration = 8000 // 8 seconds per cluster
    const maxAttempts = Math.ceil(30000 / clusterDuration) // 30 seconds worth
    
    let found = false
    let attempts = 0
    
    console.log(`\n🔍 Searching for message in next ${maxAttempts} clusters...`)
    
    for (let i = 0; i < maxAttempts; i++) {
      const cluster = await service.getNextCluster()
      attempts++
      
      if (!cluster) continue
      
      // Check focus
      if (cluster.focus.id === targetId) {
        found = true
        const elapsed = Date.now() - startTime
        console.log(`\n✅ FOUND as FOCUS in cluster ${attempts}`)
        console.log(`   Time elapsed: ${(elapsed / 1000).toFixed(1)}s`)
        break
      }
      
      // Check related messages
      if (cluster.related.some(r => r.messageId === targetId)) {
        found = true
        const elapsed = Date.now() - startTime
        console.log(`\n✅ FOUND in RELATED in cluster ${attempts}`)
        console.log(`   Time elapsed: ${(elapsed / 1000).toFixed(1)}s`)
        break
      }
      
      if (i % 2 === 0) {
        const stats = service.getStats()
        console.log(`   Cluster ${attempts}: Queue size ${stats.pool.priorityQueueSize}`)
      }
    }
    
    const totalTime = Date.now() - startTime
    console.log(`\n📊 Total time: ${(totalTime / 1000).toFixed(1)}s`)
    console.log(`   Clusters checked: ${attempts}`)
    
    expect(found).toBe(true)
    expect(totalTime).toBeLessThan(30000) // Must appear within 30 seconds
  }, 45000) // 45 second timeout

  test('should handle rapid submissions without breaking traversal', async () => {
    console.log('\n🚀 Submitting 10 messages rapidly...')
    
    const submissions = []
    for (let i = 0; i < 10; i++) {
      const msg = {
        content: `Rapid submission test ${i} - ${Date.now()}`,
        approved: true,
        created_at: new Date().toISOString(),
        deleted_at: null,
      }
      submissions.push(service.addNewMessage(msg))
    }
    
    const submitted = await Promise.all(submissions)
    const submittedIds = submitted.map(s => s!.id)
    
    console.log(`   Submitted IDs: ${submittedIds.join(', ')}`)
    
    // Verify queue grew
    const stats = service.getStats()
    console.log(`   Queue size after submissions: ${stats.pool.priorityQueueSize}`)
    expect(stats.pool.priorityQueueSize).toBeGreaterThan(0)
    
    // Fetch next 20 clusters and verify:
    // 1. No errors
    // 2. Continuity maintained
    // 3. Some new messages appear
    
    console.log('\n🔄 Fetching 20 clusters to verify system stability...')
    
    let foundCount = 0
    const clusters = []
    
    for (let i = 0; i < 20; i++) {
      const cluster = await service.getNextCluster()
      expect(cluster).toBeDefined()
      clusters.push(cluster!)
      
      // Check if any submitted messages appear
      if (submittedIds.includes(cluster!.focus.id)) {
        foundCount++
      }
      cluster!.related.forEach(r => {
        if (submittedIds.includes(r.messageId)) {
          foundCount++
        }
      })
    }
    
    console.log(`   ✅ Found ${foundCount} instances of submitted messages`)
    console.log(`   ✅ Generated ${clusters.length} clusters without errors`)
    
    // Verify continuity maintained
    for (let i = 1; i < clusters.length; i++) {
      const prev = clusters[i - 1]
      const curr = clusters[i]
      
      const prevFocusInCurrent = curr.related.some(
        r => r.messageId === prev.focus.id
      )
      
      expect(prevFocusInCurrent).toBe(true)
    }
    
    console.log(`   ✅ Continuity maintained across all ${clusters.length} clusters`)
    
    expect(foundCount).toBeGreaterThan(0)
  }, 60000)
})
