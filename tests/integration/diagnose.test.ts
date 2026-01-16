/**
 * Diagnostic Test - Traversal Issues
 * 
 * Checks database state and batch fetching to understand why only 12 unique
 * messages are being seen in the infinite traversal test.
 */

import { describe, test } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { MessageLogicService } from '@/lib/services/message-logic-service'
import { loadConfig } from '@/lib/config/message-pool-config'
import { DatabaseService } from '@/lib/services/database-service'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const shouldSkip = !SUPABASE_URL || !SUPABASE_ANON_KEY

describe.skipIf(shouldSkip)('Diagnostic Tests', () => {
  test('diagnose traversal issues', async () => {
    console.log('🔍 DIAGNOSTIC: Traversal Investigation\n')
    
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
    const dbService = new DatabaseService(supabase)
    
    // 1. Check database state
    console.log('📊 DATABASE STATE:')
    const totalCount = await dbService.getMessageCount()
    const maxId = await dbService.getMaxMessageId()
    console.log(`   Total messages: ${totalCount}`)
    console.log(`   Max ID: ${maxId}`)
    console.log()
    
    // 2. Test batch fetching directly
    console.log('🔬 TESTING BATCH FETCHING:')
    
    console.log('\n   Test 1: Fetch 200 messages from maxId DESC')
    const batch1 = await dbService.fetchBatchWithCursor(maxId, 200, 'DESC')
    console.log(`   Result: ${batch1.length} messages`)
    if (batch1.length > 0) {
      console.log(`   ID range: ${batch1[0].id} to ${batch1[batch1.length - 1].id}`)
    }
    
    console.log('\n   Test 2: Fetch next 200 messages DESC')
    const cursor2 = parseInt(batch1[batch1.length - 1].id, 10) - 1
    const batch2 = await dbService.fetchBatchWithCursor(cursor2, 200, 'DESC')
    console.log(`   Result: ${batch2.length} messages`)
    if (batch2.length > 0) {
      console.log(`   ID range: ${batch2[0].id} to ${batch2[batch2.length - 1].id}`)
    }
    
    console.log('\n   Test 3: Check for gaps in IDs')
    const allIds = [...batch1, ...batch2].map(m => parseInt(m.id, 10)).sort((a, b) => b - a)
    const gaps = []
    for (let i = 0; i < allIds.length - 1; i++) {
      const diff = allIds[i] - allIds[i + 1]
      if (diff > 1) {
        gaps.push({ from: allIds[i], to: allIds[i + 1], gap: diff })
      }
    }
    console.log(`   Found ${gaps.length} gaps in IDs`)
    if (gaps.length > 0 && gaps.length <= 10) {
      gaps.forEach(g => console.log(`      Gap: ${g.from} -> ${g.to} (${g.gap} missing)`))
    }
    
    // 3. Test MessageLogicService
    console.log('\n\n🎯 TESTING MESSAGE LOGIC SERVICE:')
    
    const config = loadConfig()
    config.workingSetSize = 200
    const service = new MessageLogicService(supabase, config)
    await service.initialize()
    
    console.log('\n   Fetching 20 clusters...')
    const seenFocusIds = new Set<string>()
    const seenAllIds = new Set<string>()
    
    for (let i = 0; i < 20; i++) {
      const cluster = await service.getNextCluster()
      if (!cluster) {
        console.log(`   ❌ Cluster ${i + 1} was null!`)
        break
      }
      
      seenFocusIds.add(cluster.focus.id)
      seenAllIds.add(cluster.focus.id)
      cluster.related.forEach(r => seenAllIds.add(r.messageId))
      
      if (i < 5 || i % 5 === 4) {
        console.log(`   Cluster ${i + 1}: Focus ${cluster.focus.id}, Related ${cluster.related.length}`)
        console.log(`      Unique focus IDs so far: ${seenFocusIds.size}`)
        console.log(`      Total unique IDs so far: ${seenAllIds.size}`)
      }
      
      // Check for immediate recycling
      if (i > 0 && cluster.focus.id === Array.from(seenFocusIds)[0]) {
        console.log(`   ⚠️  IMMEDIATE RECYCLE detected at cluster ${i + 1}!`)
        console.log(`      Focus ${cluster.focus.id} is same as cluster 1`)
        break
      }
    }
    
    console.log('\n   Summary:')
    console.log(`   Unique focus IDs: ${seenFocusIds.size}`)
    console.log(`   Total unique IDs: ${seenAllIds.size}`)
    console.log(`   Database has: ${totalCount} messages`)
    console.log(`   Coverage: ${(seenAllIds.size / totalCount * 100).toFixed(1)}%`)
    
    service.cleanup()
    
    console.log('\n✅ Diagnostic complete\n')
  }, 60000) // 60 second timeout
})
