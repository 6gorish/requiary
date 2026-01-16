/**
 * Simple Diagnostic Test
 * Tests basic cluster generation to understand validation failures
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MessageLogicService } from '@/lib/services/message-logic-service'
import type { MessagePoolConfig } from '@/types/grief-messages'
import { createTestMessages } from '../mocks/database-service'
import { createMockSupabaseClient, type MockSupabaseClient } from '../mocks/supabase-client'
import { DEFAULT_CONFIG } from '@/lib/config/message-pool-config'

describe('Simple Diagnostic', () => {
  let service: MessageLogicService
  let mockClient: MockSupabaseClient
  let config: MessagePoolConfig

  beforeEach(() => {
    config = {
      ...DEFAULT_CONFIG,
      workingSetSize: 100,
      clusterSize: 10,
      pollingInterval: 100
    }
    mockClient = createMockSupabaseClient()
  })

  afterEach(() => {
    if (service) {
      service.cleanup()
    }
  })

  it('should generate a single cluster successfully', async () => {
    console.log('\n🔍 SIMPLE DIAGNOSTIC: Single Cluster Test\n')
    
    // Create small number of test messages
    const messages = createTestMessages(200)
    console.log(`Created ${messages.length} test messages`)
    console.log(`First message: ID=${messages[0].id}, content="${messages[0].content}"`)
    console.log(`Last message: ID=${messages[messages.length-1].id}, content="${messages[messages.length-1].content}"`)
    
    mockClient.setMessages(messages)
    
    service = new MessageLogicService(mockClient as any, config)
    
    console.log('\nInitializing service...')
    await service.initialize()
    
    const stats = service.getStats()
    console.log(`\nAfter initialization:`)
    console.log(`  Working set size: ${stats.workingSetSize}`)
    console.log(`  Expected: ${config.workingSetSize}`)
    console.log(`  Priority messages: ${stats.priorityMessageCount}`)
    
    expect(stats.workingSetSize).toBe(config.workingSetSize)
    
    console.log('\nGenerating first cluster...')
    const cluster = await service.getNextCluster()
    
    expect(cluster).not.toBeNull()
    
    if (cluster) {
      console.log(`\nCluster generated successfully:`)
      console.log(`  Focus: ${cluster.focus.id}`)
      console.log(`  Related: ${cluster.related.length} messages`)
      console.log(`  Related IDs: [${cluster.related.map(r => r.messageId).join(', ')}]`)
      console.log(`  Next: ${cluster.next?.id || 'null'}`)
      
      // Check for duplicates
      const allIds = [cluster.focus.id, ...cluster.related.map(r => r.messageId)]
      const uniqueIds = new Set(allIds)
      console.log(`\n  Total IDs in cluster: ${allIds.length}`)
      console.log(`  Unique IDs: ${uniqueIds.size}`)
      
      expect(uniqueIds.size).toBe(allIds.length)
      
      // Check focus not in related
      const focusInRelated = cluster.related.some(r => r.messageId === cluster.focus.id)
      console.log(`  Focus in related? ${focusInRelated}`)
      
      expect(focusInRelated).toBe(false)
      
      // Check working set after cluster
      const statsAfter = service.getStats()
      console.log(`\nAfter first cluster:`)
      console.log(`  Working set size: ${statsAfter.workingSetSize}`)
      console.log(`  Expected: ${config.workingSetSize}`)
      
      console.log('\n✅ Test passed!')
    }
  })

  it('should generate multiple clusters', async () => {
    console.log('\n🔍 SIMPLE DIAGNOSTIC: Multiple Clusters Test\n')
    
    const messages = createTestMessages(500)
    mockClient.setMessages(messages)
    
    service = new MessageLogicService(mockClient as any, config)
    await service.initialize()
    
    console.log('Generating 5 clusters...\n')
    
    for (let i = 0; i < 5; i++) {
      console.log(`Cluster ${i + 1}:`)
      const cluster = await service.getNextCluster()
      
      expect(cluster).not.toBeNull()
      
      if (cluster) {
        console.log(`  Focus: ${cluster.focus.id}, Related: ${cluster.related.length}`)
        
        const stats = service.getStats()
        console.log(`  Working set: ${stats.workingSetSize} (expected: ${config.workingSetSize})`)
        
        expect(stats.workingSetSize).toBe(config.workingSetSize)
      }
    }
    
    console.log('\n✅ All clusters generated successfully!')
  })
})
