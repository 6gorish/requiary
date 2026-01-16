# Dual-Cursor System
## Message Traversal and Working Set Architecture

The dual-cursor system manages how grief messages flow through the visualization. It ensures every message gets witnessed while prioritizing new submissions for quick visibility.

---

## Core Concepts

### The Working Set

The working set is the heart of the system—a fixed-size array of messages that represents the entire particle universe in the visualization.

```
┌─────────────────────────────────────────────────────────────┐
│           WORKING SET (300 messages)                        │
│                                                              │
│  [Msg1][Msg2][Msg3]...[Msg300]                             │
│                                                              │
│  Each message ←→ One particle (1:1 mapping)                 │
│                                                              │
│  Properties:                                                │
│  • Fixed size (bounded memory)                              │
│  • Messages persist across cluster cycles                   │
│  • Synchronized with presentation layer                     │
└─────────────────────────────────────────────────────────────┘
```

**Why Fixed Size?**
- Bounded memory for 8+ hour exhibition days
- Predictable performance
- One-to-one mapping with particles simplifies synchronization

### The Two Cursors

**Historical Cursor** (walks backwards through time):
```
Database: [ID 1] [ID 2] ... [ID 2400] [ID 2450] [ID 2454]
                                           ↑
                                    Historical cursor
                                    (fetches older messages)
```

**New Message Watermark** (detects fresh submissions):
```
Database: [ID 1] [ID 2] ... [ID 2400] [ID 2450] [ID 2454] | [NEW!]
                                                    ↑
                                             Watermark
                                             (anything above = new)
```

---

## Message Flow

### Initialization

```typescript
async initialize(): Promise<void> {
  // 1. Set watermark to highest existing ID
  const watermark = await this.getMaxMessageId()
  this.newMessageWatermark = watermark
  
  // 2. Load initial working set
  const initialBatch = await this.poolManager.getNextBatch(
    this.config.workingSetSize
  )
  this.workingSet = initialBatch.messages
  
  // 3. Start polling for new messages
  this.startNewMessagePolling()
  
  // 4. Generate first cluster
  await this.generateNextCluster()
}
```

### The Cluster Cycle (Every 20 Seconds)

```
┌─────────────────────────────────────────────────────────────┐
│  CLUSTER SELECTION                                           │
│  ─────────────────────────────────────────────────────────  │
│  1. Previous "next" becomes current "focus"                 │
│  2. Find 12 messages most similar to focus                  │
│  3. Previous "focus" must be in related array (continuity)  │
│  4. Select new "next" from related (prefer priority queue)  │
│                                                              │
│  Result: MessageCluster object                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  DISPLAY (20 seconds)                                        │
│  ─────────────────────────────────────────────────────────  │
│  • Focus particle emphasized                                │
│  • Connection lines drawn to related messages               │
│  • Related messages cascade in pairs                        │
│  • "Next" highlighted near end of cycle                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  WORKING SET CYCLING                                         │
│  ─────────────────────────────────────────────────────────  │
│  1. Remove related messages (except focus, next)            │
│  2. Replenish from three-stage system                       │
│  3. Emit WorkingSetChange event                             │
│  4. Working set returns to target size                      │
└─────────────────────────────────────────────────────────────┘
```

### Three-Stage Replenishment

When the working set needs new messages (after removing a cluster's related messages):

```
Stage 1: PRIORITY QUEUE (in-memory)
         New submissions waiting for visibility
         Drained completely before Stage 2
         │
         ▼
Stage 2: NEW MESSAGE WATERMARK
         Check database for IDs above watermark
         Catches submissions during this cycle
         │
         ▼
Stage 3: HISTORICAL CURSOR
         Walk backwards through older messages
         Provides variety when queue is empty
```

**Why Three Stages?**
1. Priority queue is fastest (no database query)
2. Watermark catches very recent submissions
3. Historical provides variety when traffic is low

---

## Priority System

### First-Class vs. Second-Class Messages

**First-Class** (priority queue):
- New user submissions
- Detected via watermark (ID > watermark)
- Guaranteed visibility within 1-3 clusters

**Second-Class** (historical):
- Existing messages
- Enter working set from historical cursor
- Normal visibility through clustering

### How New Messages Get Priority

```typescript
// User submits message → saved to database with ID 2455

// Polling detects new message (every 5 seconds)
const newMessages = await db.from('messages')
  .select('*')
  .gt('id', this.newMessageWatermark)  // 2455 > 2454 ✓
  .eq('approved', true)

// Added to priority queue
this.priorityQueue.push(...newMessages)
this.newMessageWatermark = 2455  // Update watermark

// Next replenishment drains queue first
// Message 2455 enters working set
// ClusterSelector prefers priority messages for "next"
// Within 1-3 cycles: Message 2455 becomes focus
```

**Guarantee:** New submissions appear within ~20-60 seconds.

---

## Cluster Selection

### Similarity-Based (Not Sequential)

This is NOT a linear traversal:
```
❌ Message 1 → Message 2 → Message 3 → Message 4...
```

This IS similarity-based clustering:
```
✓ Focus: Message 5
  Related: [1, 2, 3, 4, 6, 7, 8...] (similar to 5)
  Next: Message 2 (highest similarity in related)
  
✓ Focus: Message 2 (previous next)
  Related: [5, 1, 9, 10, 11...] (similar to 2)
  Next: Message 1 (from related)
```

**Implication:** Most messages appear only in "related" arrays, never as "focus." This is correct behavior.

### Traversal Continuity

The system maintains a visual thread through clusters:

```
Cluster N:
  Focus: A
  Related: [B, C, D, E...]
  Next: B

Cluster N+1:
  Focus: B  ← (previous next becomes focus)
  Related: [A, C, G, H...]  ← (previous focus included)
  Next: C

Cluster N+2:
  Focus: C  ← (previous next becomes focus)
  Related: [B, I, J...]  ← (previous focus included)
  Next: I
```

**Why?** Creates visual continuity—the system flows from one message to related messages, not random jumps.

---

## Synchronization with Presentation Layer

### Event-Driven Architecture

```typescript
// Logic layer emits
service.emit('clusterUpdate', cluster)
service.emit('workingSetChange', { removed, added })

// Presentation layer subscribes
service.onClusterUpdate((cluster) => {
  highlightFocus(cluster.focus)
  drawConnections(cluster.related)
})

service.onWorkingSetChange(({ removed, added }) => {
  removed.forEach(id => removeParticle(id))
  added.forEach(msg => createParticle(msg))
})
```

**Critical:** Presentation MUST handle `workingSetChange`. Failure causes:
- Particles without messages (crash on access)
- Messages without particles (invisible)
- Memory leaks (orphaned particles)

### The Invariant

```
workingSet.length === particleCount === config.workingSetSize
```

This invariant must ALWAYS hold. The logic layer enforces it; the presentation layer validates it.

---

## Configuration

### Key Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `workingSetSize` | 300 | Total messages in particle universe |
| `clusterSize` | 12 | Related messages per cluster |
| `clusterDuration` | 20000ms | Time between cluster transitions |
| `pollingInterval` | 5000ms | How often to check for new messages |

### Environment Overrides

```bash
POOL_WORKING_SET_SIZE=300      # Range: 100-1000
POOL_CLUSTER_SIZE=12           # Range: 5-50
POOL_CLUSTER_DURATION=20000    # Range: 3000-30000
POOL_POLLING_INTERVAL=5000     # Range: 1000-30000
```

---

## How This Serves the Vision

| Technical Choice | Aesthetic Purpose |
|-----------------|-------------------|
| Fixed working set | Bounded memory ensures stability during 8+ hour exhibition days—the space remains reliable |
| Priority queue for new submissions | User's contribution appears quickly, honoring their act of vulnerability |
| Similarity-based clustering | Messages find kinship through meaning, not coincidence |
| Traversal continuity | The journey through grief feels intentional, not random |
| 20-second clusters | Contemplative pacing—time to read, absorb, reflect |

### The Deeper Purpose

The dual-cursor system ensures:
1. **Every message gets witnessed** (historical cursor eventually reaches all)
2. **New contributions are honored quickly** (priority queue)
3. **Connections emerge organically** (similarity clustering)
4. **The system remains stable** (fixed-size working set)

This is the infrastructure of witnessing—ensuring that no grief expression is lost, ignored, or delayed.

---

## Related Documentation

- [API Contracts](./API-CONTRACTS.md) - TypeScript interfaces
- [Configuration Reference](./CONFIGURATION.md) - All configuration options
- [Semantic Encoding](../data/SEMANTIC-ENCODING.md) - How similarity is calculated
