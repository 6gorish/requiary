# Timing System
## Message Display and Cluster Transitions

The timing system orchestrates when messages appear, how they're displayed, and when transitions occur. Every timing decision serves the contemplative aesthetic—slow enough to absorb, rhythmic enough to feel intentional.

---

## Cluster Cycle Overview

**Total cycle: 20 seconds**

```
0s ──────────────────────────────────────────────────── 20s
│                                                        │
│  Focus visible ──────────────────────────────── fade  │
│                                                        │
│  Related pairs cascade ────────────────── fade        │
│                                                        │
│                                         │Next│─────── │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Timing Configuration

Located in `app/installation/page.tsx`:

```typescript
const MESSAGE_TIMING = {
  // Per-message timing
  fadeInDuration: 1.5,       // Seconds to fade in
  holdDuration: 1.0,         // Seconds at full opacity
  fadeOutDuration: 1.5,      // Seconds to fade out
  // Total per message: 4 seconds

  pairInternalOffset: 1.5,   // Second message in pair starts 1.5s after first
  messageDuration: 4.0,      // Total visibility time per message

  // Special message timing
  nextAppearsAt: 17,         // Next message appears at 17s
  focusFadesAt: 18,          // Focus starts fading at 18s
  cycleDuration: 20,         // Total cycle duration

  // Connection line timing
  connectionFadeIn: 2,       // Connections fade in over first 2s
  connectionFadeOutStart: 16,// Connections start fading at 16s
  connectionFadeOutDuration: 2,
  focusNextTurnsRed: 14,     // Focus-next line turns red at 14s
  incomingRedDuration: 6,    // Incoming red line stays for 6s
}
```

---

## Message Types and Their Lifecycles

### Focus Message

The anchor of each cluster—remains visible throughout most of the cycle.

```
Time:     0s                                      18s   19.5s  20s
          │                                        │      │     │
Opacity:  │─fade in─│────── full opacity ─────────│─fade─│     │
          0   →   1                                1  →  0   transition
          (1.5s)                                   (1.5s)
```

**Exception:** If focus was the previous cluster's "next," it skips fade-in (already visible).

### Related Messages (Paired Cascade)

Related messages appear in pairs, creating gentle rhythm:

| Index | Pair | Start Time | End Time |
|-------|------|------------|----------|
| 0     | 1    | 0.0s       | 4.0s     |
| 1     | 1    | 1.5s       | 5.5s     |
| 2     | 2    | 4.0s       | 8.0s     |
| 3     | 2    | 5.5s       | 9.5s     |
| 4     | 3    | 8.0s       | 12.0s    |
| ...   | ...  | ...        | ...      |

**Formula:**
```typescript
startTime = messageDuration × floor(index / 2) + (isSecondInPair ? pairInternalOffset : 0)
```

**Each message opacity curve:**
```
      │   hold
      │  ┌────┐
   1.0├──┤    ├──┐
      │ /      \  \
      │/        \  \
   0.0├──────────────
      0  1.5  2.5  4.0 (seconds)
```

### Next Message

Appears near cycle end, signaling upcoming transition:

```
Time:     0s                    17s               20s
          │                      │                 │
Opacity:  │     (invisible)      │─ fade in ─│full │ → becomes focus
                                 0    →    1  1     
```

---

## Connection Lines

### Standard Connection Lines

```
Time:     0s        2s                    16s   18s  20s
          │         │                      │     │    │
Opacity:  │─ fade ──│────── full ─────────│fade─│    │
          0  →   1                         1 → 0
```

### Focus-Next Connection (Red Transition)

The line between focus and next changes color to signal upcoming transition:

```
Time:     0s              14s                   17s    20s
          │                │                     │      │
Color:    │─── purple ─────│── interpolate ──────│─ red─│
          │                │    (3s)             │      │
```

After transition, the incoming red line fades back to purple over 6 seconds.

---

## Position Caching

To prevent message text from jumping when recalculated:

```typescript
const positionCache = useRef<Map<string, PlacedMessage>>(new Map())

// In render loop:
positionedMessages = positionedMessages.map(msg => {
  const cached = positionCache.current.get(msg.id)
  if (cached) {
    return { ...cached, opacity: msg.opacity }  // Keep position, update opacity
  } else {
    positionCache.current.set(msg.id, { ...msg })
    return msg
  }
})
```

---

## Outgoing Focus Handling

When clusters transition, the old focus needs special handling:

### The Problem

The outgoing focus often appears in the new cluster's related messages. Without filtering:
1. Fades out as outgoing focus
2. Immediately animates back as related message
3. Visual stuttering

### The Solution

```typescript
if (previousFocusId && focus && focus.focus.id !== previousFocusId) {
  outgoingFocusId = previousFocusId
  filterIdsRef.current.add(previousFocusId)
  
  // Auto-remove after fade completes
  setTimeout(() => {
    filterIdsRef.current.delete(previousFocusId!)
  }, fadeCompleteTime)
}
```

---

## Particle Glow Synchronization

Particles glow brighter when their message is visible:

```typescript
if (hasVisibleMessage) {
  const intensity = messageOpacity
  
  // Shift toward warm white
  center.r += (255 - center.r) * intensity * 0.6
  center.g += (250 - center.g) * intensity * 0.5
  center.b += (230 - center.b) * intensity * 0.3
}
```

This creates visual link between text panel and source particle.

---

## Configuration Options

### Cycle Timing

| Setting | Default | Description |
|---------|---------|-------------|
| `cycleDuration` | 20s | Total cluster duration |
| `animateIn` | 3s | Connection fade-in time |
| `animateOut` | 3s | Connection fade-out time |

### Message Timing

| Setting | Default | Description |
|---------|---------|-------------|
| `fadeInDuration` | 1.5s | Message text fade-in |
| `holdDuration` | 1.0s | Full opacity hold |
| `fadeOutDuration` | 1.5s | Message text fade-out |
| `messageDuration` | 4.0s | Total per message |
| `pairInternalOffset` | 1.5s | Gap between pair members |

### Transition Timing

| Setting | Default | Description |
|---------|---------|-------------|
| `nextAppearsAt` | 17s | When next message appears |
| `focusFadesAt` | 18s | When focus starts fading |
| `focusNextTurnsRed` | 14s | When focus-next line turns red |

---

## How This Serves the Vision

| Timing Choice | Aesthetic Purpose |
|---------------|-------------------|
| 20-second cycles | Contemplative pacing—time to read and absorb |
| Paired cascade | Gentle rhythm, not overwhelming |
| 4-second message visibility | Long enough to read, short enough for variety |
| Slow fades (1.5s) | Gentle transitions, no jarring cuts |
| Red line transition | Visual signal of upcoming change |

### The Deeper Meaning

The timing creates a contemplative rhythm:
- Long enough to truly read each message
- Paired appearance suggests connection
- Predictable pacing allows relaxation
- Transitions are gentle, not abrupt

This is the temporal equivalent of walking slowly through a memorial—each expression given its moment, transitions treated with care.

---

## Modifying Timing

### To change cycle duration:

1. Update `MESSAGE_TIMING.cycleDuration`
2. Adjust `nextAppearsAt` and `focusFadesAt` proportionally
3. Update `connectionFadeOutStart`
4. Update logic layer's `clusterDuration` config

### To change message visibility:

1. Adjust `fadeInDuration`, `holdDuration`, `fadeOutDuration`
2. Update `messageDuration` to match their sum
3. Related cascade adjusts automatically

### To change pair rhythm:

1. Adjust `pairInternalOffset`
2. Smaller = more overlap, faster feel
3. Larger = more separation, slower feel

---

## Related Documentation

- [Particle System](./PARTICLE-SYSTEM.md) - Particle glow synchronization
- [Connection Lines](./CONNECTION-LINES.md) - Line opacity timing
- [Configuration Reference](./CONFIGURATION.md) - All timing settings
