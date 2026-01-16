/**
 * Diagnostic Memory Leak Test
 * 
 * Enhanced version with detailed memory tracking and diagnostics
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { MessageLogicService } from '@/lib/services/message-logic-service'
import { loadConfig } from '@/lib/config/message-pool-config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Skip if no credentials
const shouldSkip = !SUPABASE_URL || !SUPABASE_ANON_KEY

interface MemorySnapshot {
  iteration: number
  heapUsed: number
  heapTotal: number
  external: number
  arrayBuffers: number
  workingSetSize: number
  priorityCount: number
  timestamp: number
}

function takeMemorySnapshot(iteration: number, service: MessageLogicService): MemorySnapshot {
  const mem = process.memoryUsage()
  const stats = service.getStats()
  
  return {
    iteration,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
    workingSetSize: stats.workingSetSize,
    priorityCount: stats.priorityMessageCount,
    timestamp: Date.now()
  }
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

describe.skipIf(shouldSkip)('Diagnostic: Memory Leak Investigation', () => {
  let service: MessageLogicService
  let supabase: ReturnType<typeof createClient<Database>>
  
  beforeEach(async () => {
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  })
  
  afterEach(() => {
    // CRITICAL: Always cleanup, even on test failure
    if (service) {
      service.cleanup()
    }
  })

  test('DIAGNOSTIC: Memory tracking over 50 iterations', async () => {
    console.log('\n=== MEMORY LEAK DIAGNOSTIC TEST ===\n')
    
    service = new MessageLogicService(supabase, loadConfig())
    await service.initialize()
    
    const snapshots: MemorySnapshot[] = []
    const snapshotInterval = 10 // Take snapshot every 10 iterations
    
    // Take initial snapshot
    if (global.gc) {
      global.gc()
    }
    const initial = takeMemorySnapshot(0, service)
    snapshots.push(initial)
    
    console.log(`Initial: ${formatBytes(initial.heapUsed)}, WS: ${initial.workingSetSize}`)
    
    // Run iterations with periodic snapshots
    const iterations = 50
    const startTime = Date.now()
    
    for (let i = 1; i <= iterations; i++) {
      const cluster = await service.getNextCluster()
      expect(cluster).toBeDefined()
      
      // Take snapshot periodically
      if (i % snapshotInterval === 0) {
        if (global.gc) {
          global.gc()
        }
        
        const snapshot = takeMemorySnapshot(i, service)
        snapshots.push(snapshot)
        
        const growth = ((snapshot.heapUsed - initial.heapUsed) / initial.heapUsed) * 100
        const timeSinceStart = ((snapshot.timestamp - startTime) / 1000).toFixed(1)
        
        console.log(`i${i} (${timeSinceStart}s): ${formatBytes(snapshot.heapUsed)} (${growth > 0 ? '+' : ''}${growth.toFixed(1)}%), WS:${snapshot.workingSetSize}`)
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\nCompleted in ${totalTime}s (${(parseFloat(totalTime) / iterations * 1000).toFixed(0)}ms/iter)`)
    
    // Analyze memory growth
    const finalSnapshot = snapshots[snapshots.length - 1]
    const memoryGrowth = ((finalSnapshot.heapUsed - initial.heapUsed) / initial.heapUsed) * 100
    
    console.log(`Memory: ${formatBytes(initial.heapUsed)} → ${formatBytes(finalSnapshot.heapUsed)} (${memoryGrowth > 0 ? '+' : ''}${memoryGrowth.toFixed(1)}%)`)
    
    // Check for steady growth (potential leak)
    const growthRates: number[] = []
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1]
      const curr = snapshots[i]
      const rate = ((curr.heapUsed - prev.heapUsed) / prev.heapUsed) * 100
      growthRates.push(rate)
    }
    
    const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length
    
    // Working set stability check
    const workingSetSizes = snapshots.map(s => s.workingSetSize)
    const minWS = Math.min(...workingSetSizes)
    const maxWS = Math.max(...workingSetSizes)
    
    console.log(`Avg growth rate: ${avgGrowthRate > 0 ? '+' : ''}${avgGrowthRate.toFixed(2)}%/snapshot, WS range: ${minWS}-${maxWS}\n`)
    
    // Test assertions
    
    // 1. Memory should not grow more than 100% (2x)
    expect(memoryGrowth).toBeLessThan(100)
    
    // 2. Working set should be stable
    const config = service.getStats().config
    const minAcceptable = config.workingSetSize * 0.9
    const maxAcceptable = config.workingSetSize * 1.1
    
    expect(minWS).toBeGreaterThanOrEqual(minAcceptable)
    expect(maxWS).toBeLessThanOrEqual(maxAcceptable)
    
    // 3. Average growth rate should be reasonable (<10% per snapshot)
    // Note: 6-10% is normal for JS GC behavior, not a leak
    expect(Math.abs(avgGrowthRate)).toBeLessThan(10)
    
    console.log('✅ All assertions passed\n')
    
  }, 120000) // 2 minute timeout for 50 iterations
  
  test('DIAGNOSTIC: Cleanup effectiveness', async () => {
    console.log('\n=== CLEANUP TEST ===\n')
    
    // Take baseline memory
    if (global.gc) {
      global.gc()
    }
    const baseline = process.memoryUsage().heapUsed
    
    console.log(`Baseline: ${formatBytes(baseline)}`)
    
    // Create and destroy service 5 times
    const measurements: number[] = []
    
    for (let i = 0; i < 5; i++) {
      const svc = new MessageLogicService(supabase, loadConfig())
      await svc.initialize()
      
      // Generate some clusters
      for (let j = 0; j < 10; j++) {
        await svc.getNextCluster()
      }
      
      // Cleanup
      svc.cleanup()
      
      // Force GC and measure
      if (global.gc) {
        global.gc()
      }
      
      const current = process.memoryUsage().heapUsed
      measurements.push(current)
      
      const growth = ((current - baseline) / baseline) * 100
      console.log(`Cycle ${i + 1}: ${formatBytes(current)} (${growth > 0 ? '+' : ''}${growth.toFixed(1)}%)`)
    }
    
    const finalMemory = measurements[measurements.length - 1]
    const totalGrowth = ((finalMemory - baseline) / baseline) * 100
    
    console.log(`Final: ${formatBytes(baseline)} → ${formatBytes(finalMemory)} (${totalGrowth > 0 ? '+' : ''}${totalGrowth.toFixed(1)}%)\n`)
    
    // Memory should not grow significantly after multiple cycles
    expect(totalGrowth).toBeLessThan(50)
    
    console.log('✅ Cleanup is effective\n')
    
  }, 60000)
  
  test('DIAGNOSTIC: Polling timer cleanup', async () => {
    console.log('\n=== POLLING TIMER TEST ===\n')
    
    service = new MessageLogicService(supabase, loadConfig())
    await service.initialize()
    
    const stats = service.getStats()
    console.log(`Initialized: WS=${stats.workingSetSize}, polling active`)
    
    // Wait for a few polling cycles
    console.log('Waiting 5s for polling...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    const statsAfterPolling = service.getStats()
    console.log(`After polling: Queue=${statsAfterPolling.pool.priorityQueueSize}`)
    
    // Cleanup
    service.cleanup()
    
    const statsAfterCleanup = service.getStats()
    console.log(`After cleanup: Init=${statsAfterCleanup.initialized}, WS=${statsAfterCleanup.workingSetSize}, Queue=${statsAfterCleanup.pool.priorityQueueSize}\n`)
    
    // Verify cleanup worked
    expect(statsAfterCleanup.initialized).toBe(false)
    expect(statsAfterCleanup.workingSetSize).toBe(0)
    expect(statsAfterCleanup.pool.priorityQueueSize).toBe(0)
    
    console.log('✅ Polling timer cleaned up properly\n')
    
  }, 15000)
})
