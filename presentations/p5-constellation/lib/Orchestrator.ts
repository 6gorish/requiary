/**
 * Orchestrator
 * 
 * Presentation layer wrapper for MessageLogicService.
 * Handles cluster cycling, working set synchronization, and focus tracking.
 * 
 * IMPORTANT: This is the ONLY interface the p5 component should use.
 * Do NOT call MessageLogicService directly from p5.
 */

import { MessageLogicService } from '@/lib/services/message-logic-service'
import type { 
  GriefMessage, 
  MessageCluster,
  MessagePoolConfig 
} from '@/types/grief-messages'
import type { Database } from '@/types/database'

// The Supabase client type from @supabase/supabase-js
type SupabaseClient = ReturnType<typeof import('@/lib/supabase/client').createClient>

/**
 * Orchestrator Configuration
 */
export interface OrchestratorConfig {
  /** Cluster display duration (ms) */
  clusterDuration: number
  /** Working set size (particle universe) */
  workingSetSize: number
  /** Cluster size (related messages) */
  clusterSize: number
  /** Auto-cycle clusters */
  autoCycle: boolean
}

/**
 * Current Focus State
 * What the presentation layer should be drawing connections to
 */
export interface FocusState {
  /** Current focus message */
  focus: GriefMessage
  /** Related messages with similarity scores */
  related: Array<{
    message: GriefMessage
    similarity: number
  }>
  /** Next message (for continuity) */
  next: GriefMessage | null
  /** Cluster creation timestamp */
  timestamp: Date
}

export class Orchestrator {
  private messageLogic: MessageLogicService
  private config: OrchestratorConfig
  
  // Current state
  private workingSet: Map<string, GriefMessage> = new Map()
  private currentFocus: FocusState | null = null
  private cycleInterval: NodeJS.Timeout | null = null
  private initialized: boolean = false
  
  // Callbacks
  private onWorkingSetChangeCallback: ((added: GriefMessage[], removed: string[]) => void) | null = null
  private onFocusChangeCallback: ((focus: FocusState | null) => void) | null = null

  // Logging control
  private originalConsoleLog = console.log
  private originalConsoleWarn = console.warn

  private silenceLogs() {
    console.log = () => {}
    console.warn = () => {}
  }

  private restoreLogs() {
    console.log = this.originalConsoleLog
    console.warn = this.originalConsoleWarn
  }

  constructor(
    supabaseClient: SupabaseClient,
    config?: Partial<OrchestratorConfig>
  ) {
    // Default configuration
    this.config = {
      clusterDuration: config?.clusterDuration ?? 8000,
      workingSetSize: config?.workingSetSize ?? 300,
      clusterSize: config?.clusterSize ?? 20,
      autoCycle: config?.autoCycle ?? true
    }

    // Create MessageLogicService with matching config
    const poolConfig: MessagePoolConfig = {
      workingSetSize: this.config.workingSetSize,
      clusterSize: this.config.clusterSize,
      clusterDuration: this.config.clusterDuration,
      pollingInterval: 5000,
      priorityQueue: {
        maxSize: 200,
        normalSlots: 5,
        memoryAdaptive: true
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

    this.messageLogic = new MessageLogicService(supabaseClient, poolConfig)
  }

  /**
   * Initialize
   * 
   * Sets up message logic service and loads initial working set.
   * MUST be called before using orchestrator.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.messageLogic.onWorkingSetChange((change) => {
        // Update internal working set map
        change.removed.forEach(id => this.workingSet.delete(id))
        change.added.forEach(msg => this.workingSet.set(msg.id, msg))
        
        // Notify presentation layer
        if (this.onWorkingSetChangeCallback) {
          this.onWorkingSetChangeCallback(change.added, change.removed)
        }
      })

      await this.messageLogic.initialize()
      await this.cycleToNextCluster()

      if (this.config.autoCycle) {
        this.startAutoCycle()
      }

      this.initialized = true
      
    } catch (error) {
      console.error('[ORCHESTRATOR] Init failed:', error)
      throw error
    }
  }

  /**
   * Get Working Set
   * 
   * Returns all messages currently in the particle universe.
   * Use this for initial particle creation.
   */
  getWorkingSet(): GriefMessage[] {
    return Array.from(this.workingSet.values())
  }

  /**
   * Get Current Focus
   * 
   * Returns current focus state (focus + related messages).
   * Use this for drawing connection lines.
   */
  getCurrentFocus(): FocusState | null {
    return this.currentFocus
  }

  /**
   * Cycle to Next Cluster
   * 
   * Advances to next cluster and updates focus state.
   * Called automatically if autoCycle is enabled.
   */
  async cycleToNextCluster(): Promise<void> {
    if (!this.initialized && this.workingSet.size === 0) return

    try {
      const cluster = await this.messageLogic.getNextCluster()
      
      if (!cluster) {
        this.currentFocus = null
        if (this.onFocusChangeCallback) {
          this.onFocusChangeCallback(null)
        }
        return
      }

      this.currentFocus = {
        focus: cluster.focus,
        related: cluster.related,
        next: cluster.next,
        timestamp: cluster.timestamp
      }

      if (this.onFocusChangeCallback) {
        this.onFocusChangeCallback(this.currentFocus)
      }
      
    } catch (error) {
      console.error('[ORCHESTRATOR] Cycle failed:', error)
    }
  }

  /**
   * Start Auto-Cycling
   * 
   * Automatically cycles clusters at configured interval.
   */
  startAutoCycle(): void {
    if (this.cycleInterval) return
    
    this.cycleInterval = setInterval(() => {
      this.cycleToNextCluster()
    }, this.config.clusterDuration)
  }

  /**
   * Stop Auto-Cycling
   */
  stopAutoCycle(): void {
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval)
      this.cycleInterval = null
    }
  }

  /**
   * Register Working Set Change Callback
   * 
   * Called when messages are added/removed from working set.
   * Presentation layer should sync particles with this.
   */
  onWorkingSetChange(callback: (added: GriefMessage[], removed: string[]) => void): void {
    this.onWorkingSetChangeCallback = callback
  }

  /**
   * Register Focus Change Callback
   * 
   * Called when focus changes (cluster cycle).
   * Presentation layer should update connection lines.
   */
  onFocusChange(callback: (focus: FocusState | null) => void): void {
    this.onFocusChangeCallback = callback
  }

  /**
   * Submit New Message
   * 
   * Adds new message to priority queue.
   * Will appear in visualization within ~30 seconds.
   */
  async submitMessage(content: string): Promise<GriefMessage | null> {
    const newMessage = await this.messageLogic.addNewMessage({
      content: content.trim(),
      approved: true,
      created_at: new Date().toISOString(),
      deleted_at: null
    })

    return newMessage
  }

  /**
   * Get Statistics
   * 
   * Returns diagnostic info for debugging.
   */
  getStats() {
    return {
      initialized: this.initialized,
      workingSetSize: this.workingSet.size,
      currentFocusId: this.currentFocus?.focus.id || null,
      relatedCount: this.currentFocus?.related.length || 0,
      autoCycleActive: this.cycleInterval !== null,
      messageLogicStats: this.messageLogic.getStats()
    }
  }

  /**
   * Cleanup
   * 
   * Stops all timers and releases resources.
   */
  cleanup(): void {
    this.stopAutoCycle()
    this.messageLogic.cleanup()
    
    this.workingSet.clear()
    this.currentFocus = null
    this.onWorkingSetChangeCallback = null
    this.onFocusChangeCallback = null
    this.initialized = false
  }
}
