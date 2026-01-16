# Semantic Encoding
## AI-Powered Grief Message Clustering

The House of Mourning uses Anthropic's Claude API to generate semantic embeddings for grief messages. These embeddings enable the system to discover unexpected connections between messages—revealing that grief which feels isolating is often deeply shared.

---

## The Concept

### Why Semantic Encoding?

Individual grief messages are brief—up to 280 characters. Reading them in isolation, they appear as disconnected fragments:

> "My mother. Every day I reach for the phone."

> "Three years and I still set two coffee cups."

> "The dog's bowl is still by the door."

Semantic encoding allows the system to recognize that these messages share thematic kinship—all expressing the persistence of absence through daily rituals. Without AI analysis, these connections would remain invisible.

### What Emerges

When the visualization clusters semantically similar messages:
- Messages about **parental loss** find each other across time
- Expressions of **anticipatory grief** connect with **complicated grief**
- **Specific, concrete** messages cluster separately from **abstract, philosophical** ones
- The **recently bereaved** discover the **long-grieving**

The result: visitors experience grief as constellation rather than isolation.

---

## Technical Implementation

### Overview

```
User submits message
         │
         ▼
┌─────────────────────────┐
│  Anthropic Claude API        │
│  Model: claude-sonnet-4-20250514     │
│  Task: Generate 10D embedding│
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Store in Database           │
│  semantic_data: {            │
│    embedding: [-0.8, 0.3...] │
│    generated_at: timestamp   │
│  }                           │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Similarity Calculation      │
│  Cosine similarity between   │
│  embedding vectors           │
└─────────────────────────┘
```

### The Embedding Generation

```typescript
// lib/semantic-encoding.ts

export async function getSemanticEmbedding(content: string): Promise<number[] | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Generate a semantic embedding vector for this grief expression.
        Consider themes of: loss type, emotional tone, temporal relationship,
        specific vs abstract, personal vs universal.

        Message: "${content}"

        Return ONLY a JSON array of 10 numbers between -1.0 and 1.0 representing
        semantic dimensions. No explanation.

        Example format: [-0.8, 0.3, 0.7, -0.2, 0.9, -0.5, 0.1, 0.6, -0.4, 0.8]`
      }]
    })
  })

  const data = await response.json()
  const embedding = JSON.parse(data.content[0].text.trim())
  
  return embedding
}
```

### The Embedding Vector

Each message receives a 10-dimensional vector representing semantic themes:

| Dimension | Represents | Example Values |
|-----------|------------|----------------|
| 0 | Loss type (person vs. concept) | -1 (person) → +1 (abstract concept) |
| 1 | Emotional tone (raw vs. processed) | -1 (acute, raw) → +1 (reflective, processed) |
| 2 | Temporal relationship | -1 (recent) → +1 (distant past) |
| 3 | Specificity | -1 (very specific) → +1 (general, universal) |
| 4 | Relationship type | -1 (family) → +1 (self/identity) |
| 5 | Expression mode | -1 (concrete/physical) → +1 (abstract/emotional) |
| 6 | Grief stage indicators | -1 (denial/anger) → +1 (acceptance) |
| 7 | Support seeking | -1 (reaching out) → +1 (witnessing/sharing) |
| 8 | Hope/despair spectrum | -1 (despair) → +1 (hope) |
| 9 | Complexity | -1 (simple) → +1 (complicated/layered) |

**Note:** These dimensions are emergent from the prompt, not strictly enforced. Claude interprets the semantic space organically.

---

## Similarity Calculation

### Cosine Similarity

Messages are compared using cosine similarity—measuring the angle between vectors rather than their magnitude:

```typescript
// lib/semantic-encoding.ts

export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0)
  const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0))
  const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0))

  if (mag1 === 0 || mag2 === 0) return 0

  return dotProduct / (mag1 * mag2)
}
```

**Result range:** -1 (opposite) to +1 (identical)

### Normalized Similarity Score

For clustering, we normalize to 0-1:

```typescript
// Cosine similarity of -1 (opposite) → 0
// Cosine similarity of 0 (orthogonal) → 0.5
// Cosine similarity of 1 (identical) → 1
const normalized = (cosineSim + 1) / 2
```

---

## Integration with Clustering

### Weighted Similarity

Semantic similarity is one factor in the overall similarity calculation:

```typescript
// lib/utils/similarity-scoring.ts

export function calculateSimilarity(
  messageA: GriefMessage,
  messageB: GriefMessage,
  config: MessagePoolConfig['similarity']
): number {
  // Temporal proximity (60% weight by default)
  const temporal = calculateTemporalProximity(messageA.created_at, messageB.created_at)
  
  // Length similarity (20% weight)
  const length = calculateLengthSimilarity(messageA.content.length, messageB.content.length)
  
  // Semantic similarity (20% weight)
  const semantic = calculateSemanticSimilarity(messageA, messageB)

  return (
    temporal * config.temporalWeight +
    length * config.lengthWeight +
    semantic * config.semanticWeight
  )
}
```

### Default Weights

```typescript
similarity: {
  temporalWeight: 0.6,   // Messages near in time
  lengthWeight: 0.2,     // Similar length messages
  semanticWeight: 0.2    // Thematic similarity
}
```

**Why 60% temporal?** The exhibition context means recent submissions should cluster—visitors see their contribution connect with current moment.

**Why 20% semantic?** Strong enough to create meaningful connections, not so strong that timing is ignored.

---

## Graceful Degradation

### Missing Embeddings

Not all messages have embeddings (API failures, messages predating the feature):

```typescript
export function calculateSemanticSimilarity(
  messageA: GriefMessage,
  messageB: GriefMessage
): number {
  if (
    !messageA.semantic_data?.embedding ||
    !messageB.semantic_data?.embedding ||
    messageA.semantic_data.embedding.length !== 10 ||
    messageB.semantic_data.embedding.length !== 10
  ) {
    // No embeddings available - return 0 (neutral, not negative)
    return 0
  }
  
  // Calculate cosine similarity...
}
```

**Effect:** Messages without embeddings still appear in clusters (via temporal/length similarity), they just don't contribute semantic signal.

### API Failures

```typescript
export async function getSemanticEmbedding(content: string): Promise<number[] | null> {
  try {
    const response = await fetch(/* ... */)
    
    if (!response.ok) {
      console.error(`Anthropic API error: ${response.status}`)
      return null  // Message saved without embedding
    }
    
    // Parse and validate...
  } catch (error) {
    console.error('Semantic encoding error:', error)
    return null  // Graceful failure
  }
}
```

**Philosophy:** A message without an embedding is better than a failed submission. The system degrades gracefully.

---

## Performance Considerations

### API Latency

Embedding generation adds ~200-500ms to message submission. This happens server-side, so users see immediate feedback while embedding generates in background.

### Database Storage

JSONB storage with GIN index allows efficient queries:
- Storage overhead: ~100-200 bytes per message
- Query performance: Sub-millisecond for indexed lookups

### Caching

Embeddings are generated once and stored permanently. No re-computation unless model changes.

---

## How This Serves the Vision

| Technical Choice | Aesthetic Purpose |
|-----------------|-------------------|
| 10-dimensional embeddings | Rich enough for nuance, compact enough for efficiency |
| Cosine similarity | Measures meaning alignment, not vector magnitude |
| 20% semantic weight | Strong enough for connection, not so strong that recent submissions feel ignored |
| Graceful degradation | Every submission is honored, even if AI fails |
| Prompt design | Explicitly considers grief-relevant dimensions (loss type, temporal relationship, emotional processing) |

### The Deeper Purpose

Without semantic encoding, messages would cluster only by time and length—coincidental proximity. With semantic encoding, the system reveals **meaningful** proximity:

> "Three years since mom died. Some days I'm fine. Some days I can't breathe."

This message might cluster with:

> "The waves come when I least expect them. Five years in."

Not because they were submitted near each other in time, but because they share the experience of grief as unpredictable, persistent, cyclical.

This is the core promise of the installation: **grief that feels isolating discovers it is shared**.

---

## Configuration

### Environment Variables

```bash
ANTHROPIC_API_KEY=your-api-key-here
```

### Similarity Weights

Configured in `lib/config/message-pool-config.ts`:

```typescript
similarity: {
  temporalWeight: 0.6,   // Range: 0.0-1.0
  lengthWeight: 0.2,     // Range: 0.0-1.0
  semanticWeight: 0.2    // Range: 0.0-1.0
}
```

**Constraint:** Weights must sum to ≤ 1.0

---

## Related Documentation

- [Database Schema](./DATABASE-SCHEMA.md) - Where embeddings are stored
- [Dual-Cursor System](../logic/DUAL-CURSOR-SYSTEM.md) - How clusters are selected
- [Configuration Reference](./CONFIGURATION.md) - Similarity weight configuration
