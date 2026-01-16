# Logic Layer Configuration
## Message Pool and Clustering Settings

This document covers all configuration options for the business logic layer—working set size, cluster parameters, priority queue, and similarity weights.

---

## Configuration File

**Location:** `lib/config/message-pool-config.ts`

All values can be overridden via environment variables.

---

## Working Set Configuration

### workingSetSize

**Default:** 300  
**Range:** 100-1000  
**Env:** `POOL_WORKING_SET_SIZE`

Total number of messages in the particle universe. This is the fixed-size working set that maps 1:1 with particles in the visualization.

| Value | Effect |
|-------|--------|
| 100 | Minimal variety, low memory, fast clustering |
| 300 | Balanced variety and performance (recommended) |
| 600 | High variety, moderate memory |
| 1000 | Maximum variety, highest memory usage |

**Memory impact:** ~1-2KB per message in working set.

---

## Cluster Configuration

### clusterSize

**Default:** 12  
**Range:** 5-50  
**Env:** `POOL_CLUSTER_SIZE`

Number of related messages shown per cluster (connections from focus).

| Value | Effect |
|-------|--------|
| 5-8 | Sparse connections, more focused view |
| 10-15 | Balanced density (recommended) |
| 20-30 | Dense web of connections |
| 40+ | Very dense, may overwhelm |

### clusterDuration

**Default:** 20000 (20 seconds)  
**Range:** 3000-30000  
**Env:** `POOL_CLUSTER_DURATION`

How long each cluster is displayed before transitioning.

| Value | Effect |
|-------|--------|
| 3-8s | Fast pacing, dynamic feel |
| 15-25s | Contemplative pacing (recommended for exhibition) |
| 30s+ | Very slow, meditative |

---

## Polling Configuration

### pollingInterval

**Default:** 5000 (5 seconds)  
**Range:** 1000-30000  
**Env:** `POOL_POLLING_INTERVAL`

How often to check database for new submissions.

| Value | Effect |
|-------|--------|
| 1-2s | Fastest new message detection, more queries |
| 5s | Balanced responsiveness and efficiency |
| 10-30s | Lower query load, slower new message appearance |

---

## Priority Queue Configuration

### priorityQueue.maxSize

**Default:** 200  
**Range:** 50-500  
**Env:** `POOL_QUEUE_MAX_SIZE`

Maximum new messages to buffer. When exceeded, oldest are dropped.

### priorityQueue.normalSlots

**Default:** 5  
**Range:** 1-10  
**Env:** `POOL_QUEUE_NORMAL_SLOTS`

How many new messages per cluster during normal operation.

### priorityQueue.memoryAdaptive

**Default:** true  
**Env:** `POOL_QUEUE_MEMORY_ADAPTIVE`

Whether to adjust queue size based on memory pressure.

---

## Surge Mode Configuration

Activated when priority queue exceeds threshold (viral traffic scenario).

### surgeMode.threshold

**Default:** 100  
**Range:** 50-200  
**Env:** `POOL_SURGE_THRESHOLD`

Queue size that triggers surge mode.

### surgeMode.newMessageRatio

**Default:** 0.7 (70%)  
**Range:** 0.5-0.9  
**Env:** `POOL_SURGE_NEW_RATIO`

Percentage of cluster slots for new messages during surge.

### surgeMode.minHistoricalRatio

**Default:** 0.3 (30%)  
**Range:** 0.1-0.5  
**Env:** `POOL_SURGE_MIN_HISTORICAL`

Minimum percentage for historical messages (ensures variety).

---

## Similarity Weights

Control how messages are clustered. Weights must sum to ≤ 1.0.

### similarity.temporalWeight

**Default:** 0.6  
**Range:** 0.0-1.0  
**Env:** `POOL_SIMILARITY_TEMPORAL`

Weight for time proximity. Higher = cluster recent messages together.

### similarity.lengthWeight

**Default:** 0.2  
**Range:** 0.0-1.0  
**Env:** `POOL_SIMILARITY_LENGTH`

Weight for message length similarity. Higher = cluster similar-length messages.

### similarity.semanticWeight

**Default:** 0.2  
**Range:** 0.0-1.0  
**Env:** `POOL_SIMILARITY_SEMANTIC`

Weight for embedding-based semantic similarity. Higher = cluster by meaning.

---

## Configuration Profiles

### Exhibition (Default)

Optimized for contemplative gallery experience:

```typescript
{
  workingSetSize: 300,
  clusterSize: 12,
  clusterDuration: 20000,
  pollingInterval: 5000,
  similarity: {
    temporalWeight: 0.6,
    lengthWeight: 0.2,
    semanticWeight: 0.2
  }
}
```

### High Traffic

For events with many simultaneous submissions:

```typescript
{
  workingSetSize: 200,        // Lower to cycle faster
  clusterSize: 10,
  clusterDuration: 15000,     // Faster transitions
  pollingInterval: 3000,      // More frequent checks
  priorityQueue: {
    maxSize: 500,
    normalSlots: 8
  }
}
```

### Semantic Focus

To emphasize thematic connections over recency:

```typescript
{
  similarity: {
    temporalWeight: 0.2,
    lengthWeight: 0.1,
    semanticWeight: 0.7
  }
}
```

---

## Validation

The configuration system validates at startup:

1. **Range checks:** All values within allowed ranges
2. **Cross-field:** clusterSize < workingSetSize
3. **Weight sums:** similarity weights ≤ 1.0
4. **Ratio sums:** surge mode ratios ≤ 1.0

Invalid configuration throws at startup, not runtime.

---

## How Configuration Serves the Vision

| Setting | Purpose |
|---------|---------|
| 300 working set | Large enough for variety, bounded for stability |
| 12 cluster size | Enough connections to reveal patterns, not overwhelming |
| 20s duration | Contemplative pacing—time to read and absorb |
| 60% temporal weight | Recent submissions cluster together—visitors see current moment |
| 20% semantic weight | Strong enough for meaningful connections |

---

## Related Documentation

- [Dual-Cursor System](./DUAL-CURSOR-SYSTEM.md) - How configuration affects flow
- [API Contracts](./API-CONTRACTS.md) - Configuration interface
- [Semantic Encoding](../data/SEMANTIC-ENCODING.md) - How semantic weight works
