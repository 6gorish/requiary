/**
 * Grief Message Type Definitions
 *
 * Normalized interfaces for the Business Logic Layer.
 * These types are simplified from Database.Message with only essential fields.
 *
 * IMPORTANT: This is a pure business logic layer - NO visualization concepts.
 */

import type { Message } from './database'

/**
 * Grief Message
 *
 * Normalized message representation for business logic layer.
 * Simplified from Database.Message with only essential fields needed for
 * message traversal, clustering, and pool management.
 *
 * @example
 * const message: GriefMessage = {
 *   id: "12345",
 *   content: "My mother. Every day I reach for the phone.",
 *   created_at: "2025-11-14T20:30:00.000Z",
 *   approved: true,
 *   deleted_at: null
 * }
 */
export interface GriefMessage {
  /**
   * Unique identifier (database primary key)
   * Format: Numeric string from PostgreSQL SERIAL
   * @example "12345"
   */
  id: string

  /**
   * Message content (user's grief expression)
   *
   * Constraints:
   * - Length: 1-280 characters (trimmed)
   * - No HTML or markdown
   * - May contain unicode/emoji
   *
   * @example "My mother. Every day I reach for the phone."
   */
  content: string

  /**
   * Timestamp (server-side, UTC)
   * Used for ordering and temporal proximity calculations.
   *
   * @example "2025-11-14T20:30:00.000Z"
   */
  created_at: string

  /**
   * Moderation status
   * Only approved=true messages are visible.
   *
   * @default true (for MVP - auto-approve all)
   */
  approved: boolean

  /**
   * Soft delete timestamp
   * Non-null indicates message is deleted.
   * Deleted messages never appear in visualization.
   *
   * @default null
   */
  deleted_at: string | null

  /**
   * Semantic embedding data
   * Contains 10-dimensional vector representing semantic themes
   * and timestamp of when it was generated.
   *
   * @default null (if embedding generation failed)
   */
  semantic_data?: {
    embedding: number[]
    generated_at: string
  } | null
}

/**
 * Message Cluster
 *
 * Represents a complete cluster: focus message + related messages + next.
 * Emitted by MessageLogicService.onClusterUpdate()
 *
 * @example
 * const cluster: MessageCluster = {
 *   focus: { id: "100", content: "...", ... },
 *   focusId: "100",
 *   related: [
 *     { message: {...}, messageId: "99", similarity: 0.85 },
 *     { message: {...}, messageId: "98", similarity: 0.72 }
 *   ],
 *   next: { id: "101", content: "...", ... },
 *   nextId: "101",
 *   duration: 8000,
 *   timestamp: new Date(),
 *   totalClustersShown: 42
 * }
 */
export interface MessageCluster {
  /**
   * Focus message (center of current cluster)
   * This message should be visually emphasized in presentation layer.
   */
  focus: GriefMessage

  /**
   * Focus message ID (convenience accessor)
   */
  focusId: string

  /**
   * Related messages with similarity scores
   *
   * Sorted by similarity (highest first).
   * Length: 1-20 messages (configurable)
   *
   * Presentation layer should draw connections from focus to these.
   */
  related: Array<{
    /**
     * Related message
     */
    message: GriefMessage

    /**
     * Message ID (convenience accessor)
     */
    messageId: string

    /**
     * Similarity score (0.0 - 1.0)
     *
     * Factors:
     * - Temporal proximity (messages near in time)
     * - Length similarity (short vs long)
     * - Semantic similarity (future: keyword matching)
     *
     * 1.0 = Very high similarity (e.g., previous focus for traversal continuity)
     * 0.5 = Moderate similarity (default)
     * 0.0 = No similarity (should not occur)
     */
    similarity: number
  }>

  /**
   * Next message (becomes focus in next cycle)
   *
   * CRITICAL: This ensures traversal continuity.
   * The "next" message from this cluster will be the focus in next cluster.
   * Presentation layer can pre-load or highlight this message.
   *
   * May be null only if database is empty.
   */
  next: GriefMessage | null

  /**
   * Next message ID (convenience accessor)
   */
  nextId: string | null

  /**
   * Display duration (milliseconds)
   * How long this cluster should be displayed before cycling.
   *
   * @default 8000 (8 seconds)
   */
  duration: number

  /**
   * Cluster creation timestamp
   * When this cluster was assembled.
   */
  timestamp: Date

  /**
   * Total clusters shown (statistics)
   * Increments with each cycle.
   */
  totalClustersShown: number
}

/**
 * Working Set Change Event
 *
 * Emitted when messages are cycled out and replaced.
 * Presentation layer MUST synchronize particle universe with this.
 *
 * @example
 * service.onWorkingSetChange(({ removed, added, reason }) => {
 *   // Remove particles for removed IDs
 *   removed.forEach(id => particles.delete(id))
 *
 *   // Create particles for added messages
 *   added.forEach(msg => particles.create(msg))
 * })
 */
export interface WorkingSetChange {
  /**
   * Message IDs to remove
   *
   * These messages are no longer in the working set.
   * Presentation layer should:
   * 1. Remove particles for these IDs
   * 2. Clear any visual effects
   * 3. Release memory
   *
   * EXCEPTION: Previous focus ID may be in removed list but should be
   * kept for one more cycle to maintain traversal thread.
   * Check if ID matches previousFocus before removing.
   */
  removed: string[]

  /**
   * New messages to add
   *
   * These messages are now in the working set.
   * Presentation layer should:
   * 1. Create particles for these messages
   * 2. Position in particle universe
   * 3. Initialize visual state
   *
   * Source: Dual-cursor system (may be historical or priority queue)
   */
  added: GriefMessage[]

  /**
   * Change reason (for debugging/monitoring)
   *
   * @example "cluster_cycle" | "initialization" | "manual_refresh"
   */
  reason?: string
}

/**
 * Pool Statistics
 *
 * Internal state visibility for monitoring/debugging.
 * Retrieved via MessageLogicService.getPoolStats()
 */
export interface PoolStats {
  /**
   * Historical cursor position
   * Current ID in backwards traversal.
   * Null when recycling to newest.
   */
  historicalCursor: number | null

  /**
   * New message watermark
   * Highest message ID seen.
   * New messages above this go to priority queue.
   */
  newMessageWatermark: number

  /**
   * Priority queue size
   * Number of new messages waiting for visibility.
   *
   * High values trigger surge mode.
   */
  priorityQueueSize: number

  /**
   * Surge mode active
   * True when queue exceeds threshold (adaptive behavior).
   */
  surgeMode: boolean

  /**
   * Estimated queue wait time (seconds)
   * How long until queued message becomes visible.
   *
   * Target: < 30 seconds
   */
  queueWaitTime: number

  /**
   * Memory usage (percentage)
   * Estimated JavaScript heap usage.
   * Used for adaptive queue sizing.
   *
   * @range 0-100
   */
  memoryUsage: number
}

/**
 * Health Check Status
 *
 * Reports service health for monitoring.
 * Retrieved via MessageLogicService.getHealth()
 */
export interface HealthCheck {
  /**
   * Overall health status
   */
  status: 'healthy' | 'degraded' | 'unhealthy'

  /**
   * Component health breakdown
   */
  components: {
    /** Database connection status */
    database: 'up' | 'down'

    /** Pool manager status */
    poolManager: 'active' | 'stalled'

    /** Traversal cycle status */
    traversal: 'running' | 'stopped'
  }

  /**
   * Health check timestamp
   */
  timestamp: Date

  /**
   * Metrics snapshot
   */
  metrics: {
    /** Number of messages in working set */
    messagesInPool: number

    /** Average API response time (milliseconds) */
    averageResponseTime: number

    /** Error rate (0.0 - 1.0) */
    errorRate: number
  }

  /**
   * Warnings (non-fatal issues)
   * @example ["Queue size above 150", "Memory usage at 80%"]
   */
  warnings: string[]

  /**
   * Errors (fatal issues)
   * @example ["Database connection failed", "Traversal stalled"]
   */
  errors: string[]
}

/**
 * Message Pool Configuration
 *
 * All tunable parameters in one place.
 * Changes to these values should NOT require code changes.
 */
export interface MessagePoolConfig {
  /**
   * Working set size (particle universe)
   * Total number of messages active in visualization.
   *
   * @default 400
   * @range 100-1000
   *
   * Higher = More variety, more memory
   * Lower = Less variety, less memory
   */
  workingSetSize: number

  /**
   * Cluster size (related messages)
   * Number of connections drawn from focus.
   *
   * @default 20
   * @range 5-50
   */
  clusterSize: number

  /**
   * Cluster display duration (ms)
   * How long to show each focus before cycling.
   *
   * @default 8000 (8 seconds)
   * @range 3000-30000
   */
  clusterDuration: number

  /**
   * New message polling interval (ms)
   * How often to check for new submissions.
   *
   * @default 5000 (5 seconds)
   * @range 1000-30000
   *
   * Lower = Faster visibility, more queries
   * Higher = Slower visibility, fewer queries
   */
  pollingInterval: number

  /**
   * Priority queue configuration
   */
  priorityQueue: {
    /**
     * Max queue size
     * Maximum new messages to buffer.
     * Oldest dropped when exceeded.
     *
     * @default 200
     * @range 50-500
     */
    maxSize: number

    /**
     * Cluster slots (normal mode)
     * How many new messages per cluster.
     *
     * @default 5
     * @range 1-10
     */
    normalSlots: number

    /**
     * Memory adaptive
     * Adjust queue size based on available memory.
     *
     * @default true
     */
    memoryAdaptive: boolean
  }

  /**
   * Surge mode configuration
   */
  surgeMode: {
    /**
     * Activation threshold
     * Queue size triggering surge mode.
     *
     * @default 100
     * @range 50-200
     */
    threshold: number

    /**
     * Cluster slots (surge mode)
     * Percentage of cluster for new messages.
     *
     * @default 0.7 (70%)
     * @range 0.5-0.9
     */
    newMessageRatio: number

    /**
     * Minimum historical ratio
     * Ensures balanced representation.
     *
     * @default 0.3 (30%)
     * @range 0.1-0.5
     */
    minHistoricalRatio: number
  }

  /**
   * Similarity scoring weights
   */
  similarity: {
    /**
     * Temporal proximity weight
     * How much to favor messages near in time.
     *
     * @default 0.6
     * @range 0.0-1.0
     */
    temporalWeight: number

    /**
     * Length similarity weight
     * How much to favor similar length messages.
     *
     * @default 0.2
     * @range 0.0-1.0
     */
    lengthWeight: number

    /**
     * Semantic similarity weight
     * How much to favor keyword matches.
     * (Future feature)
     *
     * @default 0.2
     * @range 0.0-1.0
     */
    semanticWeight: number
  }
}

/**
 * Utility: Convert Database.Message to GriefMessage
 * Normalizes database row to business logic format.
 */
export function toGriefMessage(dbMessage: Message): GriefMessage {
  return {
    id: dbMessage.id,
    content: dbMessage.content,
    created_at: dbMessage.created_at,
    approved: dbMessage.approved,
    deleted_at: dbMessage.deleted_at,
    semantic_data: dbMessage.semantic_data
  }
}
