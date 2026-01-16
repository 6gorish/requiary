# API Contracts
## TypeScript Interfaces for the Logic Layer

This document defines the data contracts exposed by the business logic layer. These interfaces form the boundary between logic and presentation—the presentation layer knows nothing about database queries or clustering algorithms, only these contracts.

---

## Core Types

### GriefMessage

The normalized representation of a grief message.

```typescript
interface GriefMessage {
  /**
   * Unique identifier (database primary key)
   * Format: Numeric string from PostgreSQL SERIAL
   */
  id: string

  /**
   * Message content (user's grief expression)
   * Length: 1-280 characters
   */
  content: string

  /**
   * Timestamp (server-side, UTC)
   * Used for temporal proximity calculations
   */
  created_at: string

  /**
   * Moderation status
   * Only approved=true messages are visible
   */
  approved: boolean

  /**
   * Soft delete timestamp
   * Non-null indicates message is deleted
   */
  deleted_at: string | null

  /**
   * Semantic embedding data
   * Contains 10-dimensional vector for clustering
   */
  semantic_data?: {
    embedding: number[]
    generated_at: string
  } | null
}
```

---

### MessageCluster

The complete cluster emitted on each cycle.

```typescript
interface MessageCluster {
  /**
   * Focus message (center of current cluster)
   * Visually emphasized in presentation
   */
  focus: GriefMessage
  focusId: string

  /**
   * Related messages with similarity scores
   * Sorted by similarity (highest first)
   * Length: 1-20 messages (configurable)
   */
  related: Array<{
    message: GriefMessage
    messageId: string
    similarity: number  // 0.0-1.0
  }>

  /**
   * Next message (becomes focus in next cycle)
   * Ensures traversal continuity
   */
  next: GriefMessage | null
  nextId: string | null

  /**
   * Display duration (milliseconds)
   */
  duration: number

  /**
   * Cluster creation timestamp
   */
  timestamp: Date

  /**
   * Statistics
   */
  totalClustersShown: number
}
```

---

### WorkingSetChange

Event emitted when messages are cycled.

```typescript
interface WorkingSetChange {
  /**
   * Message IDs to remove
   * Presentation should remove corresponding particles
   */
  removed: string[]

  /**
   * New messages to add
   * Presentation should create new particles
   */
  added: GriefMessage[]

  /**
   * Change reason (for debugging)
   */
  reason?: string
}
```

---

### PoolStats

Internal state visibility for monitoring.

```typescript
interface PoolStats {
  /** Current position in backwards traversal */
  historicalCursor: number | null

  /** Highest message ID seen */
  newMessageWatermark: number

  /** Number of new messages waiting */
  priorityQueueSize: number

  /** Messages currently in working set */
  workingSetSize: number

  /** Total messages in database */
  totalMessagesInDatabase: number
}
```

---

## Service API

### MessageLogicService

The main orchestrator for message traversal.

```typescript
class MessageLogicService extends EventEmitter {
  /**
   * Initialize the service
   * Loads working set, sets up cursors, starts polling
   * MUST be called before start()
   */
  async initialize(): Promise<void>

  /**
   * Start traversal cycle
   * Emits first cluster immediately, then every clusterDuration ms
   */
  start(): void

  /**
   * Stop traversal cycle
   * Maintains state—can resume with start()
   */
  stop(): void

  /**
   * Cleanup all resources
   * Service cannot be reused after cleanup
   * ALWAYS call in component unmount
   */
  cleanup(): void

  /**
   * Get current cluster
   */
  getCurrentCluster(): MessageCluster | null

  /**
   * Subscribe to cluster updates
   * Called every clusterDuration ms during active traversal
   */
  onClusterUpdate(callback: (cluster: MessageCluster) => void): void

  /**
   * Subscribe to working set changes
   * CRITICAL: Must handle to maintain particle sync
   */
  onWorkingSetChange(callback: (change: WorkingSetChange) => void): void

  /**
   * Add new user-submitted message
   * Goes to priority queue for quick visibility
   */
  async addNewMessage(message: GriefMessage): Promise<void>

  /**
   * Get pool statistics
   */
  getPoolStats(): PoolStats
}
```

---

## Event Flow

### Typical Cycle

```
┌─────────────────────────────────────────────────────────────┐
│  1. clusterUpdate emitted                                   │
│     → Presentation highlights focus, draws connections      │
└────────────────────────────────────────────────────────────┘
                            │
                      (clusterDuration ms)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Working set cycled internally                           │
│     → Remove related messages                               │
│     → Replenish from three-stage system                     │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. workingSetChange emitted                                │
│     → Presentation removes/creates particles                │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Next clusterUpdate emitted                              │
│     → Previous "next" is now "focus"                        │
│     → Cycle repeats                                         │
└────────────────────────────────────────────────────────────┘
```

---

## Usage Example

```typescript
// Initialize
const service = new MessageLogicService(config)
await service.initialize()

// Subscribe to events
service.onClusterUpdate((cluster) => {
  console.log(`Focus: ${cluster.focus.content}`)
  console.log(`Related: ${cluster.related.length} messages`)
  
  // Update visualization
  highlightParticle(cluster.focusId)
  cluster.related.forEach(r => {
    drawConnection(cluster.focusId, r.messageId, r.similarity)
  })
})

service.onWorkingSetChange(({ removed, added }) => {
  // Synchronize particle universe
  removed.forEach(id => particles.delete(id))
  added.forEach(msg => particles.create(msg))
})

// Start
service.start()

// Later: cleanup
service.cleanup()
```

---

## Configuration Interface

```typescript
interface MessagePoolConfig {
  /** Total messages in particle universe */
  workingSetSize: number        // Default: 300, Range: 100-1000

  /** Related messages per cluster */
  clusterSize: number           // Default: 12, Range: 5-50

  /** Time between clusters (ms) */
  clusterDuration: number       // Default: 20000, Range: 3000-30000

  /** Polling interval for new messages (ms) */
  pollingInterval: number       // Default: 5000, Range: 1000-30000

  /** Priority queue settings */
  priorityQueue: {
    maxSize: number             // Default: 200, Range: 50-500
    normalSlots: number         // Default: 5, Range: 1-10
    memoryAdaptive: boolean     // Default: true
  }

  /** Surge mode settings */
  surgeMode: {
    threshold: number           // Default: 100, Range: 50-200
    newMessageRatio: number     // Default: 0.7, Range: 0.5-0.9
    minHistoricalRatio: number  // Default: 0.3, Range: 0.1-0.5
  }

  /** Similarity scoring weights */
  similarity: {
    temporalWeight: number      // Default: 0.6, Range: 0.0-1.0
    lengthWeight: number        // Default: 0.2, Range: 0.0-1.0
    semanticWeight: number      // Default: 0.2, Range: 0.0-1.0
  }
}
```

---

## The Boundary Principle

These interfaces form a strict boundary:

**Logic Layer Knows:**
- Database queries
- Cursor positions
- Similarity calculations
- Message lifecycle

**Logic Layer Does NOT Know:**
- Particle positions
- Colors, sizes, opacity
- Canvas/WebGL APIs
- Animation timing

**Presentation Layer Knows:**
- How to render particles
- How to draw connections
- Animation and timing

**Presentation Layer Does NOT Know:**
- Where messages come from
- How clusters are selected
- Database structure

This separation ensures each layer can be modified, tested, and debugged independently.

---

## Related Documentation

- [Dual-Cursor System](./DUAL-CURSOR-SYSTEM.md) - How messages flow
- [Configuration Reference](./CONFIGURATION.md) - All configuration options
- [Timing System](../presentation/TIMING-SYSTEM.md) - Presentation timing
