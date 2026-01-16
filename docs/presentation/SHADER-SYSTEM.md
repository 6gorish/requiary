# Shader System
## The Cosmic Background

The shader system creates the cosmic atmosphere in which grief messages float—a living, breathing nebula of purple and blue that evokes deep space, contemplation, and the vastness in which individual experiences exist.

---

## Visual Concept

### Cosmic Cathedral

The background evokes:
- Deep space nebulae (cosmic scale, infinite depth)
- Gothic cathedral darkness (sacred, contemplative)
- Bioluminescent depths (organic, living)

The shader creates the sense that particles (grief messages) float in an infinite cosmic space, each a point of light in shared darkness.

### Layered Depth

Three layers create depth:

```
┌─────────────────────────────────────────────────────────────┐
│  FOREGROUND SHADER (over particles)                         │
│  Very subtle, adds atmospheric haze                         │
├─────────────────────────────────────────────────────────────┤
│  PARTICLES                                                   │
│  Self-luminous points of light                              │
├─────────────────────────────────────────────────────────────┤
│  DARK OVERLAY                                               │
│  Semi-transparent, controls overall darkness                │
├─────────────────────────────────────────────────────────────┤
│  BACKGROUND SHADER (behind everything)                      │
│  Primary nebula effect, purple/blue clouds                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Background Shader

### The Nebula Effect

The background shader generates slowly evolving procedural clouds:

```glsl
// Simplified shader concept
void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  
  // Animated noise sampling
  float noise = fbm(uv * noiseScale + time * animationSpeed);
  
  // Color with purple/blue tint
  vec3 color = tintColor * noise;
  
  // Tone mapping for smooth gradients
  color = pow(color, vec3(toneMapping));
  
  gl_FragColor = vec4(color * brightness, 1.0);
}
```

### Breathing Effect

The shader brightness oscillates with multiple overlapping sine waves:

```typescript
// Three overlapping sine waves create non-repetitive breathing
const breath1 = Math.sin(shaderBreathTime * 0.17) * 0.35  // 5.9s period
const breath2 = Math.sin(shaderBreathTime * 0.11) * 0.25  // 9.1s period
const breath3 = Math.sin(shaderBreathTime * 0.07) * 0.15  // 14.3s period

// Combined: ±75% oscillation
const bgBreathing = breath1 + breath2 + breath3

// Apply to brightness
const bgBrightness = shaderConfig.brightness * (1.0 + bgBreathing)
cosmicShader.setUniform('u_brightness', bgBrightness)
```

**Why ±75%?** Large amplitude makes breathing clearly visible—the cosmic background pulses noticeably, creating a sense that the entire space is alive.

### Configuration

```typescript
cosmicShader: {
  brightness: 0.4,          // Base brightness (0.0-1.0)
  tintColor: { r: 0.3, g: 0.2, b: 1.0 },  // Purple/blue
  animationSpeedX: 0.15,    // Horizontal drift speed
  animationSpeedY: 0.126,   // Vertical drift speed
  noiseScale: 3.0,          // Cloud structure size
  contrast: 5.5,            // Cloud definition
  toneMapping: 2.5,         // Dynamic range compression
}
```

---

## Dark Overlay

### Purpose

The dark overlay sits between background shader and particles, allowing:
- Bright, defined nebula clouds
- Still-dark overall aesthetic
- Particles that pop against darkness

### Configuration

```typescript
darkOverlay: {
  color: { r: 0, g: 0, b: 0 },  // Pure black
  opacity: 0.4,                  // 40% opacity
}
```

**Effect:** Background shader shows through at 60% intensity, creating rich texture while maintaining dark cathedral aesthetic.

---

## Foreground Shader

### Purpose

A very subtle atmospheric layer over particles:
- Adds depth perception
- Creates sense of atmosphere between viewer and particles
- Softens harsh edges

### Configuration

```typescript
foregroundShader: {
  enabled: true,
  brightness: 0.18,              // Very subtle
  tintColor: { r: 0.2, g: 0.15, b: 0.8 },
  animationSpeedX: 0.08,         // Slower than background
  animationSpeedY: 0.06,
  noiseScale: 2.0,               // Larger cloud structures
  contrast: 4.0,                 // Softer definition
  toneMapping: 2.0,
}
```

**Key difference from background:** Lower brightness, slower movement, larger structures—creates atmospheric perspective.

---

## ISF Shader Reference

The cosmic shader is adapted from ISF (Interactive Shader Format). The original can be viewed at:
`editor.isf.video/shaders/6913c57266081f001a4aa471`

### What We Adapted

- Purple/blue color palette (from original)
- FBM noise structure (simplified)
- Animation approach (modified speeds)
- Added brightness LFO modulation

---

## Performance Considerations

### GPU Load

Shader complexity is moderate:
- Single noise function (not heavy FBM)
- Low resolution sampling possible
- No per-particle calculations

### Mobile Optimization

On mobile devices:
- Shader resolution reduced
- Animation speed slightly increased (fewer frames at same visual rate)
- Foreground shader may be disabled

### Memory

Shader textures and buffers:
- Background: ~2MB
- Foreground: ~1MB
- Total GPU memory: ~5MB (including particle buffers)

---

## Color Psychology

### Why Purple/Blue?

The color palette evokes:
- **Night sky:** Contemplation, vastness, stars
- **Deep ocean:** Depth, mystery, bioluminescence
- **Bruising:** The physical mark of grief
- **Twilight:** Liminal space between states

### Why Not Black?

Pure black background would:
- Feel dead, empty, void
- Make particles float in nothingness
- Lose the sense of cosmic context

The nebula provides:
- Living atmosphere
- Sense of shared space
- Context for the constellation metaphor

---

## Breathing Synchronization

The shader breathing is **not synchronized** with particle breathing:
- Shader: Coordinated ±75% oscillation
- Particles: Individual 4-20s random periods

**Why?** Different rhythms create organic complexity. Synchronized breathing would feel mechanical.

---

## Configuration Reference

### All Shader Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `cosmicShader.brightness` | 0.4 | Base brightness |
| `cosmicShader.tintColor` | {0.3, 0.2, 1.0} | Purple/blue RGB |
| `cosmicShader.animationSpeedX` | 0.15 | Horizontal drift |
| `cosmicShader.animationSpeedY` | 0.126 | Vertical drift |
| `cosmicShader.noiseScale` | 3.0 | Cloud size |
| `cosmicShader.contrast` | 5.5 | Cloud definition |
| `cosmicShader.toneMapping` | 2.5 | Dynamic range |
| `darkOverlay.opacity` | 0.4 | Darkness amount |
| `foregroundShader.enabled` | true | Atmospheric layer |
| `foregroundShader.brightness` | 0.18 | Very subtle |

### Breathing Amplitude

Currently hardcoded in `page.tsx`:
```typescript
const breath1 = Math.sin(shaderBreathTime * 0.17) * 0.35  // ±35%
const breath2 = Math.sin(shaderBreathTime * 0.11) * 0.25  // ±25%
const breath3 = Math.sin(shaderBreathTime * 0.07) * 0.15  // ±15%
// Combined: ±75%
```

---

## How This Serves the Vision

| Technical Choice | Aesthetic Purpose |
|-----------------|-------------------|
| Purple/blue palette | Night sky, contemplation, cosmic scale |
| Slow animation | Meditative pacing, not distracting |
| ±75% breathing | Clearly alive, the cosmos breathes |
| Dark overlay | Cathedral darkness with rich texture |
| Foreground haze | Atmospheric depth, not flat |

### The Deeper Meaning

The cosmic background situates grief in vastness. Individual particles (messages) exist in infinite space—small but luminous. The breathing nebula suggests that this cosmic context is alive, present, witnessing. The darkness is not empty void but living atmosphere.

This is the visual equivalent of sitting in a darkened cathedral: surrounded by something larger than yourself, held by space that breathes.

---

## Related Documentation

- [Particle System](./PARTICLE-SYSTEM.md) - What floats in the cosmos
- [Connection Lines](./CONNECTION-LINES.md) - What connects particles
- [Configuration Reference](./CONFIGURATION.md) - All visual settings
