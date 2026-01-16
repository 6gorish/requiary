# Sonification System
## The Sound of Collective Grief

**Requiary**  
Technical & Philosophical Documentation

---

## Overview

The sonification layer transforms the same semantic data that drives visual clustering into a living, breathing soundscape. Like the particle visualization, the audio does not exist as a preset ambient bed with messages dropped into it—the sound **emerges from** the aggregate presence of grief expressions in the working set.

This document describes the philosophical foundations, compositional strategies, and technical implementation of the audio system.

---

## Philosophical Foundations

### The Inductive Principle in Sound

Just as the visual field emerges from 300 individual glowing particles rather than being a preset environment, the sonic field emerges from the aggregate of individual sonic contributions. The ambient texture is not a backdrop—it is the sum of parts.

This means:
- The bass drone responds to the current cluster's semantic content
- Harmonic resonances emerge from connection similarities
- The texture of the field shifts as the working set evolves
- Remove the messages, and the sound would change fundamentally

### Grief Doesn't Resolve

A critical insight that shaped the entire harmonic architecture: **grief doesn't resolve**. Unlike tonal music that creates tension and releases it, grief is a state that persists. It may transform, but it doesn't "end" in the way a cadence ends a phrase.

This led to several foundational decisions:
- **Modal harmony** rather than tonal progressions
- **No dominant-tonic resolutions** that would create a sense of "arrival" or "completion"
- **Horizontal movement** (melody) over vertical movement (chord progressions)
- **Sustained tones** that evolve in timbre rather than pitch

The soundscape holds space for grief without promising resolution.

### Technology as Transparency

As with the visual system, the audio technology should become invisible. Visitors should feel held, contemplative, perhaps moved—but they should never think "that's a nice oscillator." Every technical decision serves the emotional and sacred purpose of the experience.

---

## Baroque Compositional Strategies

The sonification system draws on Baroque compositional techniques, adapted for a contemplative, non-teleological context.

### Figured Bass as Foundation

Baroque music built upward from a bass line. The **Ground Layer** serves this function:
- A Markov chain cycles through bass tones: A1 → E2 → D2 → F#2
- Each bass state persists for 2-5 minutes
- Crossfades of 12 seconds prevent sudden shifts
- All harmonic content is calculated relative to the current bass

This creates a slowly-shifting harmonic floor from which all other layers derive their pitch content.

### Affekt and the Doctrine of Affects

Baroque composers believed specific musical gestures conveyed specific emotional states (affects). The **Figura Layer** adapts this concept:

| Gesture | Baroque Affect | Our Adaptation |
|---------|---------------|----------------|
| 6→5 (la→sol) | Yearning, longing | Most common sigh, unresolved desire |
| 4→3 (fa→mi) | Tenderness, softness | Gentle resolution without finality |
| 2→1 (re→do) | Arrival, completion | Rare—used sparingly as grief doesn't truly resolve |

These "sighs" happen at geological pace (20-40 seconds per gesture) and are heavily reverberant, placing them at the back of the soundstage—felt more than heard.

### Counterpoint Without Teleology

Traditional counterpoint creates tension that resolves. Our **Cantus Layer** uses Markov chain note selection to create melodic motion that **wanders without arriving**:
- Phrases start and end on tonic (I), providing grounding
- Movement between notes favors stepwise motion (as in species counterpoint)
- But there is no cadential formula—phrases simply fade rather than conclude
- Heavy reverb (85% wet) pushes the vocals deep into the soundstage

### Ornamentation as Sonic Detail

Where Baroque ornamentation added surface detail to structural tones, our **Texture Layer** provides subliminal sonic grit:
- Vinyl crackle, tape hiss, atmospheric fizz
- Very low gain (15%)—felt, not heard
- Creates analog warmth against digital precision
- Cycles slowly (45-120 seconds) to avoid repetition detection

---

## The Timbre Principle

Electronic music is fundamentally about **changes in timbre over time**. Unlike acoustic music where timbre is relatively fixed (a violin sounds like a violin), electronic music can continuously transform its sonic character.

This insight shaped how semantic data maps to sound:

### Semantic Encoding → Timbral Modulation

Rather than mapping semantic similarity to pitch alone (which would create melodic chaos), the system maps embedding data to **timbral parameters**:
- Filter cutoff frequency
- Oscillator detune amount
- Reverb send levels
- Envelope attack times

The pitch content is constrained to a pentatonic scale relative to the bass, ensuring consonance. The **character** of that pitch—bright or dark, pure or beating, dry or wet—responds to semantic content.

### Beating and Detuning

The **Cluster Channel** uses 4 detuned oscillators:
- Slight pitch differences create acoustic beating
- Beating rate is controlled by detune amount (±5 cents default)
- Slower beating feels more contemplative
- Timbral variation from beating substitutes for melodic complexity

---

## Layer Architecture

The system implements a multi-layer audio architecture with sophisticated routing.

### Routing Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  SYNTHETIC LAYERS                                                │
│  (Ground, Cluster, Figura)                                       │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                          │
│  │ Ground  │  │ Cluster │  │ Figura  │                          │
│  │ (Bass)  │  │ (Tones) │  │ (Sighs) │                          │
│  └────┬────┘  └────┬────┘  └────┬────┘                          │
│       │            │            │                                │
│       └────────────┼────────────┘                                │
│                    │                                             │
│                    ▼                                             │
│           ┌───────────────┐                                      │
│           │   Cluster     │  (Tames oscillator beating)          │
│           │  Compressor   │  Threshold: -18dB, Ratio: 4:1        │
│           └───────┬───────┘                                      │
│                   │                                              │
└───────────────────┼──────────────────────────────────────────────┘
                    │
                    ▼
              ┌───────────┐
              │ Master    │  ◄── Sample Layers (bypass compressor)
              │   Bus     │  ◄── Reverb Return
              └─────┬─────┘
                    │
                    ▼
            ┌──────────────┐
            │ Master Glue  │  (Very gentle, just cohesion)
            │  Compressor  │  Threshold: -12dB, Ratio: 1.5:1
            └──────┬───────┘
                   │
                   ▼
            ┌─────────────┐
            │   Output    │
            └─────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SAMPLE LAYERS                                                   │
│  (Field, Texture, Shimmer, Cantus)                               │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │  Field  │  │ Texture │  │ Shimmer │  │ Cantus  │             │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘             │
│       │            │            │            │                   │
│       └────────────┴────────────┴────────────┘                   │
│                         │                                        │
│                         │  (Bypass cluster compressor)           │
│                         │                                        │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                          ▼
                    To Master Bus
```

### Why Dual Compressors?

The **Cluster Compressor** tames the oscillator beating in synthetic layers. When 4 detuned oscillators align in phase, amplitude spikes occur. The compressor catches these swells without affecting the sample-based layers (which are already mastered).

The **Master Glue Compressor** provides gentle cohesion—just enough to make all layers feel like they belong together, without pumping or obvious compression artifacts.

Sample layers bypass the cluster compressor because:
- They're already dynamically controlled during production
- Compressing field recordings creates unnatural pumping
- The "baked-in" reverb on shimmer samples would be affected

---

## Individual Layer Documentation

### Ground Layer (Bass Drone)

**Purpose**: Establish harmonic foundation from which all other pitch content derives.

**Implementation**:
- Single sine wave oscillator with subtle second harmonic (2x frequency at 30% level)
- Markov chain transitions between four bass notes
- State duration: 2-5 minutes (configurable via speed multiplier)
- Frequency glide: 50ms (prevents clicks without audible portamento)

**Bass Notes**:
| Note | Frequency | Scale Degree | Character |
|------|-----------|--------------|----------|
| A1 | 55 Hz | I (Tonic) | Home, grounding |
| D2 | 73.42 Hz | IV | Subdominant, plagal weight |
| E2 | 82.41 Hz | V | Dominant, expectant |
| F#2 | 92.50 Hz | VI | Dorian color, bittersweet warmth |

**Markov Transition Matrix**:

| From \ To | A1 | D2 | E2 | F#2 |
|-----------|-----|-----|-----|-----|
| **A1** | 15% | 35% | 40% | 10% |
| **D2** | 45% | — | 40% | 15% |
| **E2** | 50% | 35% | — | 15% |
| **F#2** | 60% | 10% | 30% | — |

**Musical Reasoning**: 
- The tonic (A1) can move anywhere but favors the dominant (E2) and subdominant (D2)
- D2 and E2 have strong gravity back to tonic (45-50%)
- F#2 (Dorian sixth) is rare but when it appears, it strongly resolves home (60%)
- Self-transitions are allowed only from A1 (15%) to occasionally extend the tonic
- The progression circulates without functional resolution—it breathes, not cadences

**Mixer Default**: 46%

---

### Cluster Channel

The cluster channel is the most complex, with three sub-components:

#### Ensemble (Main Cluster Tones)

**Purpose**: Sonify the current focus message's semantic content.

**Implementation**:
- 4 sine oscillators with configurable detuning (±5 cents default)
- Pitch derived from focus message embedding → pentatonic scale degree → frequency relative to bass
- Low-pass filter (800Hz default) for warmth
- 8-second fade in, 6-second fade out

**Mixer Default**: 44%

#### Pivot Tone

**Purpose**: Foreshadow the next cluster's harmonic content.

**Implementation**:
- Single sine oscillator
- Pitch derived from next message's embedding
- Fades in at 17 seconds into the 26-second cluster cycle
- Creates smooth harmonic transition between clusters

**Mixer Default**: 60%

#### Connection Resonances

**Purpose**: Sonify semantic similarity between focus message and related messages.

**Implementation**:
- One oscillator per connection
- Pitch = tonic × interval ratio (based on similarity)
- Higher similarity → more consonant intervals:

| Similarity | Interval | Musical Quality |
|------------|----------|-----------------|
| > 0.80 | Octave (2.0) | Perfect consonance |
| > 0.65 | Fifth (1.5) | Strong consonance |
| > 0.50 | Major third (1.25) | Sweet consonance |
| > 0.35 | Fourth (1.333) | Mild consonance |
| > 0.20 | Minor third (1.2) | Soft tension |
| ≤ 0.20 | Major second (1.125) | Gentle dissonance |

**Mixer Default**: 100%

---

### Figura Layer (Sighs)

**Purpose**: Create distant harmonic gestures evoking Baroque affect.

**Implementation**:
- Three gesture types: yearning (6→5), tender (4→3), arrival (2→1)
- Weighted probability: yearning 50%, tender 35%, arrival 15%
- Glacial timing: 12s suspend, 8s resolve, 12s decay
- Heavy reverb routing (80% send)
- Pure sine waves in octave 3 for environmental presence

**Mixer Default**: 5%

**Timing**:
- Random triggers every 70-140 seconds
- Can also trigger on cluster change (25% probability) or focus fade (45% probability)

---

### Field Layer

**Purpose**: Ambient texture bed providing spatial depth.

**Implementation**:
- Crossfades between ambient samples (shimmer-processed field recordings)
- Sample list includes: subway ambience, thunder, sirens, children playing, airport, pigeons
- Cycle duration: 30-90 seconds per sample
- Crossfade: 8 seconds
- No reverb send (samples have reverb baked in)

**Mixer Default**: 21%

---

### Texture Layer

**Purpose**: Subliminal lo-fi character—felt, not heard.

**Implementation**:
- Cycles through vinyl crackle, tape hiss, fizzpop textures
- Very slow cycles: 45-120 seconds
- Very slow crossfades: 12 seconds
- No reverb (direct grit)

**Mixer Default**: 15%

---

### Shimmer Layer

**Purpose**: Event-triggered sonic punctuation.

**Implementation**:
- One-shot samples triggered probabilistically
- Rate limiting: minimum 2 seconds between triggers, maximum 3 concurrent
- Random trigger system: 8-25 second intervals
- Some reverb send (40%)

**Mixer Default**: 40%

---

### Cantus Layer

**Purpose**: Rare melodic vocal interventions evoking distant choir.

**Implementation**:
- Lidell vocal samples mapped to scale degrees I-VIII
- Markov chain note selection favoring stepwise motion
- Phrases: 3-6 notes with 30% overlap (legato)
- Always starts on tonic, 70% probability of ending on tonic
- Dedicated convolver reverb at 85% wet
- Interval: 5-15 minutes between phrases (adjustable for testing)

**Sample Mapping**:
| Sample | Degree | Role |
|--------|--------|------|
| lidell-104 | I | Tonic (phrase anchor) |
| lidell-106 | II | Upper neighbor |
| lidell-107 | III | Mediant |
| lidell-111 | IV | Subdominant |
| lidell-112 | V | Dominant |
| lidell-114 | VI | Submediant |
| lidell-116 | VII | Leading tone |
| lidell-119 | VIII | Upper tonic |

**Mixer Default**: 50%

---

## Memory Management

### Sample Cache

Audio samples are decoded to uncompressed PCM in memory. A 1-minute stereo 44.1kHz file consumes ~10MB. With multiple layers loading overlapping sample sets, memory could balloon quickly.

The **SampleCache** singleton prevents duplicate loading:
- Each file is decoded once, shared by reference
- AudioBuffers are immutable, so sharing is safe
- Reference counting tracks usage across layers
- Memory usage logging on initialization

### Timeout Tracking

Web Audio requires careful cleanup. Every `setTimeout` used for scheduling (crossfades, phase transitions, cleanup) is tracked in a `Set` and cleared on `stop()`:
- `cleanupTimeouts` in Field, Texture layers
- `phaseTimeouts` per sigh in Figura layer
- `fadeOutTimeouts` in Cluster channel

This prevents memory leaks from orphaned callbacks holding references to disconnected audio nodes.

---

## Debug Mixer

The **AudioDebugMixer** component provides real-time control and monitoring:

### Channel Strips
- Per-channel fader (0-200%)
- Mute (M) and Solo (S) buttons
- Activity indicator (green = has content)
- Sample name display for sample-based layers
- Cantus degree display (I-VIII) with phrase activity

### Parameter Sections
- **Cluster**: Detune (cents), Attack (s), Release (s), Filter (Hz)
- **Ground**: Bass Speed multiplier (0.25x to 4x)
- **Cantus**: Interval (minutes), manual Trigger button

### Diagnostics Footer
- Current bass note and frequency
- Active resonance count
- Cluster compressor gain reduction (yellow if > 3dB)
- Master compressor gain reduction (green if < 2dB)
- Current sample names for Field, Texture, Shimmer
- Elapsed time

---

## Configuration

All parameters are centralized in `lib/config/sonification-config.ts`:

```typescript
export const DEFAULT_SONIFICATION_CONFIG: SonificationConfig = {
  master: { gain: 0.7 },
  
  reverb: {
    irPath: '/church-medium.ogg',
    wet: 0.3,
    dry: 0.7
  },
  
  ground: {
    bassNotes: [55, 82.5, 73.4, 92.5],  // A1, E2, D2, F#2
    stateMinDuration: 120000,            // 2 minutes
    stateMaxDuration: 300000,            // 5 minutes
    crossfadeDuration: 12000,            // 12 seconds
    gain: 0.46
  },
  
  cluster: {
    oscillatorCount: 4,
    baseDetuneCents: 5,
    gain: 0.44,
    fadeInDuration: 8000,
    fadeOutDuration: 6000,
    pivotFadeInStart: 17,
    pivotGain: 0.60,
    resonancesGain: 1.0
  },
  
  // ... additional layer configs
}
```

Configuration changes take effect on next initialization—no code changes required for tuning.

---

## Future Directions

### Spring Physics Audio

Planned integration with visual spring physics:
- Connection line tension → harmonic tension
- Line oscillation → amplitude modulation
- Visual "settling" → sonic resolution

### Spatial Audio

For multi-speaker installations:
- Particle positions → spatial placement
- Connection lines → audio movement between speakers
- Cluster emergence → spatial density

### Visitor Presence

With occupancy sensing:
- More visitors → richer harmonic density
- Empty room → sparser, more contemplative
- Visitor proximity to screen → focus message prominence

---

## Credits

**Samples**: Field recordings; Lidell vocal samples used under license.

**Reverb IR**: "Church Medium" convolution impulse response.

**Theoretical Influences**: 
- Morton Feldman's late works (single events separated by vast silences)
- Baroque figured bass and doctrine of affects
- Pauline Oliveros' Deep Listening practice
- Brian Eno's ambient music principles

---

*Documentation last updated: January 2026*
