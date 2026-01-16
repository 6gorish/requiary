# Connection Lines
## Spring Physics and Catenary Curves

Connection lines reveal semantic relationships between grief messages. They are the visual manifestation of hidden kinship—showing that grief which feels isolating is often deeply shared.

---

## Aesthetic Vision

### Gossamer Spider Silk

Connection lines should feel like **gossamer spider silk**—delicate, organic, living threads that:
- Never appear straight or rigid
- Have natural slack and looseness
- Move with gentle, coordinated breathing
- Exhibit gradual, elegant curvature

**Not:** Engineered, mechanical, or computer-generated.

### The Natural Hang

A cable hanging between two points doesn't form a straight line—it forms a **catenary curve**, the natural shape of flexible material responding to gravity. Our connection lines use this principle to feel organic rather than digital.

---

## Catenary Curves

### What is Catenary?

A catenary is the curve formed by a flexible chain hanging under its own weight. It's nature's solution to tension—the shape you see in:
- Suspension bridge cables
- Power lines between poles
- Spider silk strands

### Implementation: perpHomeOffset

Instead of control points resting on the straight line between particles, they rest at a **naturally curved position** perpendicular to the line:

```
WITHOUT perpHomeOffset (straight line home):
Particle A ──────────── Control Point ──────────── Particle B
                        (springs to straight line)

WITH perpHomeOffset (catenary curve home):
Particle A ─────┐              ┌───── Particle B
                 ╲            ╱
                  ● ← perpHomeOffset
                  (springs to curved position)
```

### Length-Dependent Slack

Longer lines have more natural sag:

```typescript
const slackFactor = 0.15 + (normalizedLength * 0.35)
// Short lines: 15% slack (taut)
// Long lines: 50% slack (loose)
```

**Physical analogy:** Short spider silk under high tension vs. long silk sagging under its own weight.

---

## Spring Physics

### Dual-Axis System

Each control point has physics on two axes:

**Parametric Axis** (slides along line length):
- Home position: t = 0.33 or t = 0.67
- Very weak forces (near-zero longitudinal scale)
- Control points are essentially locked in place

**Perpendicular Axis** (billows sideways):
- Home position: perpHomeOffset (the catenary curve)
- Stronger forces
- Creates visible organic motion

```typescript
// Force toward curved home position
const springForce = cp.springConstant * (cp.perpHomeOffset - cp.perpOffset)

// Damping for smooth settling
const dampingForce = -cp.damping * cp.perpVelocity

// External forces (global breathing)
const totalForce = springForce + dampingForce + cp.perpendicularForce
```

### Why Minimal Parametric Motion?

Excessive parametric sliding (control points moving along the line's length) creates visible "joints"—inflection points where the Bezier curve bends sharply. By nearly locking control points at their parametric positions, all visible motion becomes smooth perpendicular billowing.

---

## Global Breathing

The entire system breathes as one organism:

```typescript
// Multiple overlapping sine waves (prime number periods)
const breathe1 = Math.sin(globalTime * 0.3) * 3     // Period: ~21s
const breathe2 = Math.sin(globalTime * 0.19) * 2    // Period: ~33s
const breathe3 = Math.sin(globalTime * 0.13) * 1.5  // Period: ~48s

// Spatial waves (regional coordination)
const spatialWave1 = Math.sin(lineCenterX * 0.003 + wavePhase) * 2
const spatialWave2 = Math.cos(lineCenterY * 0.004 + wavePhase * 0.7) * 1.5

// Apply to perpendicular axis
cp.perpendicularForce += breathe1 + breathe2 + breathe3 + spatialWave1 + spatialWave2
```

**Why Prime Number Periods?** Creates non-repetitive organic motion. The system never exactly repeats, yet feels coordinated—like wind through a web.

---

## Connection Line Appearance

### Default Lines (Purple)

```typescript
connectionColors: {
  default: { r: 200, g: 180, b: 255 },
}

defaultConnectionOpacity: 0.6
defaultConnectionWidth: 2
```

Purple connection lines:
- Blend with cosmic shader background
- Visible without dominating
- Feel ethereal, not technical

### Focus-Next Lines (Red)

```typescript
connectionColors: {
  focus: { r: 255, g: 120, b: 100 },
}

focusConnectionOpacity: 0.8
focusConnectionWidth: 6
```

The line between focus and next particles turns red to signal upcoming transition.

### Opacity Lifecycle

```
Cluster Start     Mid-Cluster        Cluster End
     │                │                   │
     ▼                ▼                   ▼
┌─────────────────────────────────────────────┐
│ Fade In │──── Full Opacity ────│ Fade Out  │
│  (2s)   │                      │   (2s)    │
└─────────────────────────────────────────────┘
```

---

## Rendering

### Cubic Bezier Curves

Connection lines are rendered as cubic Bezier curves with two control points:

```typescript
function drawConnection(from: Particle, to: Particle, controlPoints: ControlPoint[]) {
  const [cp1, cp2] = controlPoints
  
  beginPath()
  moveTo(from.x, from.y)
  bezierCurveTo(
    cp1.x, cp1.y,    // First control point
    cp2.x, cp2.y,    // Second control point
    to.x, to.y       // End point
  )
  stroke()
}
```

### Control Point Positions

Two control points at t ≈ 0.33 and t ≈ 0.67 along the line:

```
Particle A ───●───────────●─── Particle B
              ↑           ↑
           CP1 (t=0.33)  CP2 (t=0.67)
```

Each control point oscillates around its catenary home position, creating smooth organic curves.

---

## Physics Configuration

### Spring Constants

```typescript
base: {
  springConstant: 0.8,    // Soft springs for gentle motion
  damping: 0.45,          // Moderate damping for smooth settling
  mass: 1.0
}
```

### Parametric Locking

```typescript
parametric: {
  longitudinalScale: 0.005,  // Near-zero—control points locked in place
}
```

This critical setting prevents visible sliding/joints. All motion is perpendicular billowing.

### Length Scaling

```typescript
lengthScaling: {
  springExponent: 1.5,      // Longer lines = softer springs
  massExponent: 0.7,        // Longer lines = more mass
  deviationFactor: 0.15,    // Base perpendicular deviation
}
```

---

## Performance

### Update Frequency

- Desktop: 60 updates/second
- Mobile: 30 updates/second

### Distant Simplification

Lines far from camera (when zoomed) use simplified physics. Currently disabled but available for performance tuning.

---

## How This Serves the Vision

| Technical Choice | Aesthetic Purpose |
|-----------------|-------------------|
| Catenary curves | Natural hanging shape, not engineered |
| perpHomeOffset | Lines are always curved, even at rest |
| Locked parametric position | No visible joints or inflection points |
| Global breathing | System feels alive, coordinated, organic |
| Prime number periods | Non-repetitive motion, feels natural |
| High damping | Slow, gentle motion appropriate to grief |

### The Deeper Meaning

Connection lines reveal that grief expressions share hidden kinship. The organic, gossamer quality suggests that these connections are natural—not imposed by technology, but discovered by it. The gentle breathing implies that the web of shared grief is alive, responsive, present.

The catenary curve is particularly meaningful: it's the shape that emerges naturally when something flexible connects two points. It cannot be forced into straightness. Like grief, it finds its own level.

---

## Related Documentation

- [Particle System](./PARTICLE-SYSTEM.md) - What lines connect
- [Timing System](./TIMING-SYSTEM.md) - When lines appear/disappear
- [Configuration Reference](./CONFIGURATION.md) - Physics settings
- [Spring Physics Config](../../../lib/config/spring-physics-config.ts) - Full configuration
