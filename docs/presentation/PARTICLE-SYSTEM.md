# Particle System
## Grief Messages as Points of Light

Each grief message in the constellation is rendered as a self-luminous particle—a glowing point of light that exists as a witnessed, honored presence in the shared cosmos.

---

## Core Principles

### Stationary Particles

**Particles do not move.**

This is a fundamental aesthetic decision: votive candles don't drift around; they remain as fixed points of light, witnessed and honored in their positions. Movement would undermine the contemplative quality—the sense of a stable, sacred space.

The particle universe is a still field. Only connection lines move (gentle billowing). This contrast makes the system feel alive while maintaining reverence.

### Self-Luminous Glow

Particles are not lit by external light sources. They glow from within, like:
- Votive candles in a darkened cathedral
- Bioluminescent organisms in deep ocean
- Stars in a night sky

This self-luminosity creates depth without requiring complex 3D lighting.

---

## Rendering Approach

### Radial Gradient Spheres

Each particle is rendered as a radial gradient from bright center to transparent edge:

```typescript
// Simplified rendering logic
function drawParticle(x: number, y: number, radius: number, color: ParticleColor) {
  const gradient = createRadialGradient(x, y, 0, x, y, radius)
  
  gradient.addColorStop(0.0, color.center)    // Bright core
  gradient.addColorStop(0.4, color.mid)       // Mid glow
  gradient.addColorStop(1.0, 'transparent')   // Fade to nothing
  
  fillCircle(x, y, radius, gradient)
}
```

### Alpha Breathing

Each particle breathes independently—subtle opacity oscillation over 4-20 second periods:

```typescript
const breathingPeriod = 4 + Math.random() * 16  // 4-20 seconds
const alpha = baseAlpha + Math.sin(time / breathingPeriod) * 0.15
```

**Why?** Creates organic, living quality without movement. The field feels alive, each particle with its own rhythm.

---

## Particle Colors

### Default (Warm Gold)

```typescript
default: {
  center: { r: 255, g: 220, b: 140 },  // Bright warm white
  mid: { r: 255, g: 200, b: 120 },     // Warm gold
}
```

Warm gold evokes:
- Candlelight
- Sacred spaces
- Warmth despite darkness

### Focus (Red Emphasis)

```typescript
focus: {
  center: { r: 255, g: 100, b: 80 },   // Bright red-white
  mid: { r: 255, g: 90, b: 70 },       // Deep red
}
```

Red distinguishes the current focus particle, drawing attention without being harsh.

### Burning Brightly Effect

When a particle's message is currently visible, it glows brighter:

```typescript
if (hasVisibleMessage) {
  const intensity = messageOpacity
  center.r += (255 - center.r) * intensity * 0.6
  center.g += (250 - center.g) * intensity * 0.5
  center.b += (230 - center.b) * intensity * 0.3
}
```

This creates a visual link between the text panel and its source particle—visitors can see which light holds the words they're reading.

---

## Positioning

### Random Distribution with Collision Avoidance

Particles are positioned randomly but with minimum spacing to prevent overlap:

```typescript
function positionParticle(existingParticles: Particle[]): Position {
  const minDistance = 30  // Minimum pixels between particles
  
  for (let attempts = 0; attempts < 100; attempts++) {
    const x = Math.random() * canvasWidth
    const y = Math.random() * canvasHeight
    
    const tooClose = existingParticles.some(p => 
      distance(x, y, p.x, p.y) < minDistance
    )
    
    if (!tooClose) return { x, y }
  }
  
  // Fallback: accept position even if close
  return { x: Math.random() * canvasWidth, y: Math.random() * canvasHeight }
}
```

### Position Caching

Once positioned, particles never move. Positions are cached permanently:

```typescript
const positionCache = new Map<string, Position>()

function getParticlePosition(messageId: string): Position {
  if (positionCache.has(messageId)) {
    return positionCache.get(messageId)!
  }
  
  const position = positionParticle(existingParticles)
  positionCache.set(messageId, position)
  return position
}
```

---

## Particle Lifecycle

### Creation (on WorkingSetChange)

```typescript
service.onWorkingSetChange(({ added }) => {
  added.forEach(message => {
    const position = positionParticle(existingParticles)
    const particle = createParticle(message, position)
    particles.push(particle)
    positionCache.set(message.id, position)
  })
})
```

### Existence

Particles exist as long as their message is in the working set. They:
- Breathe independently (alpha oscillation)
- Glow brighter when their message is displayed
- Receive connection lines when in a cluster

### Removal (on WorkingSetChange)

```typescript
service.onWorkingSetChange(({ removed }) => {
  removed.forEach(id => {
    const index = particles.findIndex(p => p.messageId === id)
    if (index !== -1) {
      particles.splice(index, 1)
    }
    // Position cache cleared to allow reuse
    positionCache.delete(id)
  })
})
```

---

## Size Variation

Particle size can vary based on message properties:

```typescript
const baseRadius = 8
const lengthFactor = message.content.length / 280  // 0-1 based on length
const radius = baseRadius + lengthFactor * 4       // 8-12 pixel radius
```

**Effect:** Longer messages create slightly larger particles, adding subtle visual variation without being distracting.

---

## Performance Considerations

### Particle Count

- **Target:** 300 particles (configurable)
- **Performance:** 60fps on modern devices
- **Memory:** ~1-2KB per particle

### Rendering Optimization

Particles use simple radial gradients—no complex shaders or 3D geometry. This ensures:
- Consistent performance across devices
- No GPU memory issues during 8+ hour exhibition
- Graceful degradation on older hardware

### Mobile Considerations

On mobile devices:
- Particle count may be reduced (200-250)
- Glow radius slightly smaller
- Breathing effect simplified

---

## Configuration

### Particle Colors

Configured in `lib/config/visualization-config.ts`:

```typescript
particleColors: {
  default: {
    center: { r: 255, g: 220, b: 140 },
    mid: { r: 255, g: 200, b: 120 },
  },
  focus: {
    center: { r: 255, g: 100, b: 80 },
    mid: { r: 255, g: 90, b: 70 },
  },
}
```

### Related Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `workingSetSize` | 300 | Total particle count |
| Breathing period | 4-20s | Random per particle |
| Min spacing | 30px | Collision avoidance |
| Base radius | 8px | Particle size |

---

## How This Serves the Vision

| Technical Choice | Aesthetic Purpose |
|-----------------|-------------------|
| Stationary particles | Votive candles don't move—stillness invites contemplation |
| Self-luminous glow | Each message generates its own light, not illuminated externally |
| Independent breathing | The field feels alive, each grief with its own rhythm |
| Warm gold default | Candlelight warmth in darkness |
| Position caching | Once placed, messages are witnessed in their spot |

### The Deeper Meaning

Each particle is a person's grief made visible—a point of light in shared darkness. The stillness honors that each expression deserves to be witnessed where it landed, not shuffled around. The breathing suggests life without implying that grief moves on or diminishes. The warmth provides comfort without denial.

---

## Related Documentation

- [Connection Lines](./CONNECTION-LINES.md) - How particles are connected
- [Shader System](./SHADER-SYSTEM.md) - The cosmic background
- [Configuration Reference](./CONFIGURATION.md) - All visual settings
