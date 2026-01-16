/**
 * Cluster Rotation Test
 * 
 * CRITICAL TEST: Verifies that consecutive clusters do NOT share messages
 * except for continuity (previous focus and next message).
 * 
 * This test addresses the bug where currently-displayed messages were
 * being re-selected in consecutive clusters, causing the same 20 messages
 * to repeat every cycle.
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

describe.skipIf(shouldSkip)('Critical Behavior: Cluster Rotation', () => {
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

  test('should NOT reselect currently-displayed messages in consecutive clusters', async () => {
    console.log('\n🔍 CRITICAL TEST: Cluster Rotation\n')
    console.log('Testing that consecutive clusters do NOT share messages')
    console.log('(except for continuity: previous focus and next message)\n')
    
    const clusters = []
    const maxClusters = 10
    
    // Generate consecutive clusters
    for (let i = 0; i < maxClusters; i++) {
      const cluster = await service.getNextCluster()
      expect(cluster).toBeDefined()
      clusters.push(cluster!)
    }
    
    console.log(`✅ Generated ${clusters.length} consecutive clusters\n`)
    
    // Check each pair of consecutive clusters
    let totalViolations = 0
    
    for (let i = 1; i < clusters.length; i++) {
      const prev = clusters[i - 1]
      const curr = clusters[i]
      
      // Get all IDs from each cluster
      const prevIds = new Set([
        prev.focus.id,
        ...prev.related.map(r => r.messageId)
      ])
      
      const currIds = new Set([
        curr.focus.id,
        ...curr.related.map(r => r.messageId)
      ])
      
      // Find overlap
      const overlap = [...prevIds].filter(id => currIds.has(id))
      
      console.log(`Cluster ${i - 1} → Cluster ${i}:`)
      console.log(`  Prev cluster IDs (${prevIds.size}): ${Array.from(prevIds).slice(0, 5).join(', ')}...`)
      console.log(`  Curr cluster IDs (${currIds.size}): ${Array.from(currIds).slice(0, 5).join(', ')}...`)
      console.log(`  Overlap count: ${overlap.length}`)
      
      // Identify ALLOWED overlaps:
      // 1. prev.focus should be in curr.related (for continuity)
      // 2. curr.focus should be prev.next (for continuity)
      const allowedOverlaps = new Set<string>()
      
      // Previous focus should appear in current related
      if (curr.related.some(r => r.messageId === prev.focus.id)) {
        allowedOverlaps.add(prev.focus.id)
        console.log(`  ✓ Allowed: prev.focus (${prev.focus.id}) in curr.related`)
      }
      
      // Current focus should have been previous next
      if (prev.next && curr.focus.id === prev.next.id) {
        allowedOverlaps.add(curr.focus.id)
        console.log(`  ✓ Allowed: curr.focus (${curr.focus.id}) was prev.next`)
      }
      
      // Find UNEXPECTED overlaps (violations)
      const violations = overlap.filter(id => !allowedOverlaps.has(id))
      
      if (violations.length > 0) {
        console.log(`  ❌ VIOLATIONS: ${violations.length} messages re-selected`)
        console.log(`     Violated IDs: ${violations.slice(0, 10).join(', ')}${violations.length > 10 ? '...' : ''}`)
        totalViolations += violations.length
      } else {
        console.log(`  ✅ Only allowed continuity overlap`)
      }
      
      console.log()
      
      // CRITICAL ASSERTION: Should have minimal overlap
      // Maximum 2 overlaps allowed: previous focus + next
      expect(overlap.length).toBeLessThanOrEqual(2)
      
      // CRITICAL ASSERTION: All overlaps should be allowed (continuity)
      expect(violations.length).toBe(0)
    }
    
    console.log(`\n📊 RESULTS:`)
    console.log(`   Cluster pairs checked: ${clusters.length - 1}`)
    console.log(`   Total violations: ${totalViolations}`)
    
    if (totalViolations === 0) {
      console.log(`   ✅ PASS: No messages were incorrectly re-selected\n`)
    } else {
      console.log(`   ❌ FAIL: ${totalViolations} messages were incorrectly re-selected\n`)
    }
    
    expect(totalViolations).toBe(0)
  }, 60000)

  test('should rotate through different messages over many clusters', async () => {
    console.log('\n🔍 EXTENDED TEST: Message Rotation Over 20 Clusters\n')
    
    const clusters = []
    const maxClusters = 20
    const allSeenIds = new Set<string>()
    
    // Generate many clusters
    for (let i = 0; i < maxClusters; i++) {
      const cluster = await service.getNextCluster()
      expect(cluster).toBeDefined()
      clusters.push(cluster!)
      
      // Track all IDs seen
      allSeenIds.add(cluster!.focus.id)
      cluster!.related.forEach(r => allSeenIds.add(r.messageId))
    }
    
    console.log(`✅ Generated ${clusters.length} clusters`)
    console.log(`   Total unique messages seen: ${allSeenIds.size}\n`)
    
    // With cluster size 20 and 20 clusters, we should see:
    // - Minimum: ~20 unique messages (if recycling same cluster)
    // - Expected: 300+ unique messages (working set size)
    // - Maximum: workingSetSize + some replacements
    
    const expectedMinimum = 100 // Should see at least 100 different messages
    
    console.log(`📊 RESULTS:`)
    console.log(`   Unique messages seen: ${allSeenIds.size}`)
    console.log(`   Expected minimum: ${expectedMinimum}`)
    
    if (allSeenIds.size >= expectedMinimum) {
      console.log(`   ✅ PASS: Good message rotation\n`)
    } else {
      console.log(`   ❌ FAIL: Insufficient message rotation (stuck recycling?)\n`)
    }
    
    expect(allSeenIds.size).toBeGreaterThanOrEqual(expectedMinimum)
  }, 120000)
})
