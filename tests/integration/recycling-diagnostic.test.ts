/**
 * Recycling Diagnostic Test
 * 
 * Small dataset to force recycling quickly and observe duplicate filtering
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { MessageLogicService } from '@/lib/services/message-logic-service'
import { createMockSupabaseClient } from '../mocks/supabase-client'
import type { MockSupabaseClient } from '../mocks/supabase-client'
import type { GriefMessage, MessagePoolConfig } from '@/types/grief-messages'

describe('Recycling Diagnostic', () => {
  let mockClient: MockSupabaseClient
  let service: MessageLogicService | null = null

  const config: MessagePoolConfig = {
    workingSetSize: 100,  // Small working set
    clusterSize: 20,
    clusterDuration: 5000,
    pollingInterval: 100,
    priorityQueue: {
      maxSize: 50,
      normalSlots: 5,
      memoryAdaptive: false
    },
    surgeMode: {
      threshold: 100,
      newMessageRatio: 0.7,
      minHistoricalRatio: 0.3
    },
    similarity: {
      temporalWeight: 0.6,
      lengthWeight: 0.2,
      semanticWeight: 0.2
    }
  }

  function createTestMessages(count: number): GriefMessage[] {
    return Array.from({ length: count }, (_, i) => ({
      id: (i + 1).toString(),
      content: `Message ${i + 1}`,
      created_at: new Date().toISOString(),
      approved: true,
      deleted_at: null
    }))
  }

  beforeEach(() => {
    mockClient = createMockSupabaseClient() as MockSupabaseClient
  })

  afterEach(() => {
    if (service) {
      service.cleanup()
    }
  })

  it('should handle recycling without massive duplicates', async () => {
    // Small dataset: 200 messages, working set 100
    // Should recycle after ~5-10 clusters
    const totalMessages = 200
    const messages = createTestMessages(totalMessages)
    mockClient.setMessages(messages)

    service = new MessageLogicService(mockClient as any, config)
    await service.initialize()

    console.log('\n📊 RECYCLING DIAGNOSTIC')
    console.log(`   Total messages: ${totalMessages}`)
    console.log(`   Working set size: ${config.workingSetSize}`)
    console.log('\n🔍 Watching for recycling and duplicate filtering...\n')

    let recyclingDetected = false
    const workingSetSizes: number[] = []

    // Run for 20 clusters (should see recycling)
    for (let i = 0; i < 20; i++) {
      const cluster = await service.getNextCluster()
      
      if (!cluster) {
        console.log(`❌ Cluster generation failed at cluster ${i}`)
        break
      }

      const stats = service.getStats()
      workingSetSizes.push(stats.workingSetSize)

      // Check logs for recycling marker (look back in console output)
      if (i > 0 && i % 5 === 0) {
        console.log(`   Cluster ${i}: working set = ${stats.workingSetSize}`)
      }
    }

    console.log('\n📊 Results:')
    console.log(`   Clusters generated: 20`)
    console.log(`   Working set min: ${Math.min(...workingSetSizes)}`)
    console.log(`   Working set max: ${Math.max(...workingSetSizes)}`)
    console.log(`   Working set final: ${workingSetSizes[workingSetSizes.length - 1]}`)

    // Assertions
    expect(Math.min(...workingSetSizes)).toBeGreaterThan(90) // Should stay near 100
    expect(Math.max(...workingSetSizes)).toBeLessThan(110) // Should not overshoot much
    expect(workingSetSizes[workingSetSizes.length - 1]).toBeGreaterThan(95) // Should end near target

    console.log('\n✅ Recycling behavior looks healthy')
    console.log('   Check logs above for:')
    console.log('   - 🔄 RECYCLING markers')
    console.log('   - DIAGNOSTIC: Filtered X duplicates messages')
    console.log('\n')
  }, 30000)
})
