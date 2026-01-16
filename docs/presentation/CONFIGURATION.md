# Presentation Layer Configuration
## Visual Settings Reference

This document covers all configuration options for the presentation layer—particles, connection lines, shaders, timing, and spring physics.

---

## Configuration Files

| File | Purpose |
|------|---------|
| `lib/config/visualization-config.ts` | Colors, timing, shader settings |
| `lib/config/spring-physics-config.ts` | Connection line physics |
| `app/installation/page.tsx` | Message timing (MESSAGE_TIMING) |

---

## Visualization Configuration

### Timing Settings

```typescript
// lib/config/visualization-config.ts

cycleDuration: 20000,        // 20 seconds per cluster
animateIn: 3000,             // Connection fade-in (3s)
animateOut: 3000,            // Connection fade-out (3s)
animateOutCushion: 4000,     // Start fade 4s before cycle end

connectionFocusCushion: 6000,  // Focus-next turns red 6s before end
connectionFocusDuration: 6000, // Red line stays 6s after transition
```

### Particle Colors

```typescript
particleColors: {
  default: {
    center: { r: 255, g: 220, b: 140 },  // Warm white core
    mid: { r: 255, g: 200, b: 120 },     // Gold glow
  },
  focus: {
    center: { r: 255, g: 100, b: 80 },   // Red-white core
    mid: { r: 255, g: 90, b: 70 },       // Deep red glow
  },
}
```

### Connection Colors

```typescript
connectionColors: {
  default: { r: 200, g: 180, b: 255 },   // Purple
  focus: { r: 255, g: 120, b: 100 },     // Red
}

defaultConnectionOpacity: 0.6
defaultConnectionWidth: 2
focusConnectionOpacity: 0.8
focusConnectionWidth: 6
```

### Background

```typescript
backgroundColor: { r: 10, g: 5, b: 20 }  // Deep purple-black
```

---

## Cosmic Shader Configuration

### Background Shader

```typescript
cosmicShader: {
  brightness: 0.4,           // Base brightness (0.0-1.0)
  tintColor: { r: 0.3, g: 0.2, b: 1.0 },  // Purple/blue
  animationSpeedX: 0.15,     // Horizontal cloud drift
  animationSpeedY: 0.126,    // Vertical cloud drift
  noiseScale: 3.0,           // Cloud structure size
  contrast: 5.5,             // Cloud definition
  toneMapping: 2.5,          // Dynamic range compression
}
```

### Dark Overlay

```typescript
darkOverlay: {
  color: { r: 0, g: 0, b: 0 },  // Black
  opacity: 0.4,                  // 40% opacity
}
```

### Foreground Shader

```typescript
foregroundShader: {
  enabled: true,
  brightness: 0.18,          // Very subtle
  tintColor: { r: 0.2, g: 0.15, b: 0.8 },
  animationSpeedX: 0.08,     // Slower than background
  animationSpeedY: 0.06,
  noiseScale: 2.0,           // Larger structures
  contrast: 4.0,             // Softer definition
  toneMapping: 2.0,
}
```

### Shader Breathing (Hardcoded)

In `app/installation/page.tsx`:

```typescript
// Three overlapping sine waves for organic breathing
const breath1 = Math.sin(shaderBreathTime * 0.17) * 0.35  // ±35%
const breath2 = Math.sin(shaderBreathTime * 0.11) * 0.25  // ±25%
const breath3 = Math.sin(shaderBreathTime * 0.07) * 0.15  // ±15%
// Combined: ±75% brightness oscillation
```

---

## Spring Physics Configuration

### Base Physics

```typescript
// lib/config/spring-physics-config.ts

base: {
  springConstant: 0.8,    // Soft springs
  damping: 0.45,          // Moderate damping
  mass: 1.0
}
```

### Parametric Locking

```typescript
parametric: {
  enabled: true,
  minT: 0.15,             // Control point range minimum
  maxT: 0.85,             // Control point range maximum
  longitudinalScale: 0.005,  // Near-zero = locked in place
  bounceRestitution: 0.3
}
```

**Critical:** `longitudinalScale` is near-zero to prevent visible sliding of control points along lines.

### Length Scaling

```typescript
lengthScaling: {
  springExponent: 1.5,      // Longer lines = softer springs
  massExponent: 0.7,        // Longer lines = more mass
  deviationFactor: 0.15,    // Base perpendicular deviation
}
```

### Control Point Coupling

```typescript
coupling: {
  enabled: true,
  strength: 0.2,           // Coupling strength between CP1 and CP2
  delay: 2                  // Frames of delay
}
```

### Global Breathing Forces

Applied in physics update (not configurable):

```typescript
const breathe1 = Math.sin(globalTime * 0.3) * 3     // ~21s period
const breathe2 = Math.sin(globalTime * 0.19) * 2    // ~33s period
const breathe3 = Math.sin(globalTime * 0.13) * 1.5  // ~48s period
```

---

## Message Timing Configuration

### In `app/installation/page.tsx`:

```typescript
const MESSAGE_TIMING = {
  fadeInDuration: 1.5,       // Message fade-in (seconds)
  holdDuration: 1.0,         // Full opacity hold
  fadeOutDuration: 1.5,      // Message fade-out
  messageDuration: 4.0,      // Total per message

  pairInternalOffset: 1.5,   // Gap between pair members

  nextAppearsAt: 17,         // When "next" message appears
  focusFadesAt: 18,          // When focus starts fading
  cycleDuration: 20,         // Total cycle duration

  connectionFadeIn: 2,
  connectionFadeOutStart: 16,
  connectionFadeOutDuration: 2,
  focusNextTurnsRed: 14,
  incomingRedDuration: 6,
}
```

---

## Device-Specific Overrides

### Mobile

```typescript
deviceOverrides: {
  mobile: {
    base: { springConstant: 1.0, damping: 0.3, mass: 1.0 },
    performance: { updateFrequency: 30 }  // Reduced for battery
  }
}
```

### Tablet

```typescript
deviceOverrides: {
  tablet: {
    performance: { updateFrequency: 45 }
  }
}
```

---

## Quick Tuning Guide

### Make particles warmer:
```typescript
particleColors.default.center = { r: 255, g: 240, b: 180 }
particleColors.default.mid = { r: 255, g: 220, b: 150 }
```

### Make connections more visible:
```typescript
defaultConnectionOpacity: 0.8  // Increase from 0.6
defaultConnectionWidth: 3      // Increase from 2
```

### Make shader brighter:
```typescript
cosmicShader.brightness: 0.5   // Increase from 0.4
darkOverlay.opacity: 0.3       // Decrease from 0.4
```

### Make breathing more dramatic:
```typescript
// In page.tsx, increase amplitudes:
const breath1 = Math.sin(shaderBreathTime * 0.17) * 0.45  // Was 0.35
```

### Slow down connection line motion:
```typescript
base.damping: 0.6  // Increase from 0.45
```

### Make connection curves looser:
```typescript
lengthScaling.deviationFactor: 0.25  // Increase from 0.15
```

---

## How Configuration Serves the Vision

| Setting | Purpose |
|---------|---------|
| Soft springs (0.8) | Gentle, not jittery motion |
| High damping (0.45) | Slow settling, contemplative |
| Near-zero longitudinal | No visible joints, smooth curves |
| 20s clusters | Time to read and absorb |
| ±75% shader breathing | Clearly alive, cosmic pulse |
| Warm gold particles | Candlelight warmth in darkness |

---

## Related Documentation

- [Particle System](./PARTICLE-SYSTEM.md) - Particle rendering details
- [Connection Lines](./CONNECTION-LINES.md) - Spring physics details
- [Shader System](./SHADER-SYSTEM.md) - Cosmic background details
- [Timing System](./TIMING-SYSTEM.md) - Message display timing
