# Requiary
## Technical Documentation

---

## The Vision

Requiary is an interactive web application that transforms anonymous grief expressions into a luminous particle constellation. Each message becomes a glowing point of light in a shared cosmos—stationary, witnessed, honored. The system reveals hidden connections between individual experiences of loss through semantic clustering, creating ephemeral constellations that emerge and dissolve like breath.

The work creates a **contemporary, secular space for collective witness of grief**. Visitors witness mourning not as isolation, but as a constellation of shared humanity.

---

## Philosophical Foundations

The technical and aesthetic decisions in this system emerge from a coherent philosophical framework. Understanding these foundations helps explain why the system works the way it does.

### The Inductive Principle

*"The essential is apprehended only through the particular."* — Aristotelian insight  
*"No ideas but in things."* — William Carlos Williams

This application begins with a paradox: grief is both universal and deeply personal. The system honors this by building upward from particulars rather than downward from abstractions. The ambient field—whether visual or sonic—is not a preset environment into which messages are placed. It **emerges from** the aggregate presence of individual grief messages.

Each message is a particular. The constellation is their sum. The universal (collective grief) is apprehended only through the particular (individual expressions). This inductive architecture means the installation cannot exist without the messages; they are not decorations on a background but the source of everything visitors experience.

### Emissive Presence, Not Ambient Context

The particles **glow**—they emit light. They do not reflect an external light source. This is not a cosmetic distinction; it defines the relationship between individual messages and the visual field.

In traditional ambient systems, elements exist *within* a preset environment. Here, the particles *create* the environment. The cosmic shader background is atmospheric context—it provides depth and breathing—but the warmth and light come from the particles themselves. Remove the messages, and the warmth disappears.

This principle extends to sound: each message has a **sonic presence**. The ambient soundscape is the aggregate of individual emissions, not a preset drone with modulation applied. The sound field emerges from the data, just as the visual field does.

### Technology as Transparency

Borrowing from James Turrell's principle that the best technology becomes invisible, every technical decision serves one purpose: allowing visitors to connect with aspects of their interiority that were previously inaccessible. The particles, the clustering algorithm, the spring physics, the semantic embeddings—none of these should be *noticed*. Visitors should feel held, witnessed, and connected, without ever thinking about how the system works.

When technology succeeds, it disappears. What remains is the encounter with grief—theirs and others'.

### The Particular and the Universal in Practice

| System Element | Particular | Universal (Emergent) |
|----------------|------------|---------------------|
| Visual field | Individual particles | Constellation glow |
| Sound field | Individual emissions | Harmonic ambience |
| Meaning | Single grief expression | Semantic clusters revealing connection |
| Time | 20-second cluster | Hours of contemplation |
| Space | One message position | 300-point cosmos |

The system never declares universals directly. It presents particulars and allows universals to emerge. This is why the installation can sustain hours of viewing without fatigue—each moment reveals new particulars, and the universal continuously reconstitutes itself from them.

---

## Aesthetic Philosophy

Every technical decision in this system serves a single purpose: **creating sacred space for contemplation**.

### Core Principles

**Stillness Over Motion**  
Particles remain stationary—votive candles don't move. They exist as witnessed, honored points of light. Connection lines billow gently like gossamer spider silk, but the particles themselves are anchored, creating a stable field for contemplation.

**Emergence Over Declaration**  
Meaning emerges from the collective. Individual messages are brief and anonymous; the power comes from seeing hundreds coexist, discovering unexpected kinship through semantic resonance. The system reveals connections rather than imposing them.

**Technology as Transparency**  
The technical infrastructure should become invisible. Visitors connect with grief—their own and others'—not with impressive technology. Museum-quality aesthetics require that every detail feels effortless and inevitable.

**Contemplative Restraint**  
The visual equivalent of a moment of silence. No ornamentation for its own sake. Every element has purpose. White space breathes. Typography is precise. Animation serves reflection, never distraction.

### Reference Points

**Visual Inspiration**:
- teamLab's immersive environments (organic, living systems)
- Nonotak's geometric precision with organic flexibility
- James Turrell's light installations (transcendent simplicity)
- Deep sea bioluminescence (natural glow, cosmic depth)

**Design Standards**:
- White cube galleries: Gagosian, David Zwirner (generous space, minimal distraction)
- Museum websites: MoMA, Tate Modern (sophisticated, information-rich without clutter)
- Luxury contemplative brands: Aesop, Byredo, The Row (quality over ornamentation)
- Memorial spaces: Vietnam Veterans Memorial, 9/11 Memorial (dignity, individual + collective presence)

---

## Architecture Overview

The system maintains strict separation between three layers, each with distinct responsibilities and no knowledge of the others' internal workings.

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                          │
│  p5.js WEBGL • Particles • Connection Lines • Shaders       │
│  "What the visitor sees"                                     │
└───────────────────────────────────────────────────────────────┘
                              │
                              │ MessageCluster, WorkingSetChange events
                              │
┌─────────────────────────────────────────────────────────────┐
│  BUSINESS LOGIC LAYER                                        │
│  Working Set • Dual Cursors • Clustering • Priority Queue   │
│  "How messages flow through the system"                      │
└───────────────────────────────────────────────────────────────┘
                              │
                              │ SQL queries via Supabase
                              │
┌─────────────────────────────────────────────────────────────┐
│  DATA LAYER                                                  │
│  PostgreSQL • Messages Table • Semantic Embeddings          │
│  "Where grief is stored and retrieved"                       │
└───────────────────────────────────────────────────────────────┘
```

**Why This Matters**: Version 1 of this project failed because layers were entangled. The business logic knew about particle positions; the data layer was queried from rendering code. This made the system impossible to test, debug, or modify. The strict separation is non-negotiable.

---

## Documentation Structure

### [Data Layer](./data/)
Database schema, storage, semantic encoding.

| Document | Description |
|----------|-------------|
| [Database Schema](./data/DATABASE-SCHEMA.md) | Tables, columns, indexes, RLS policies |
| [Semantic Encoding](./data/SEMANTIC-ENCODING.md) | Anthropic API integration for message embeddings |
| [Configuration Reference](./data/CONFIGURATION.md) | Data layer configuration options |

### [Logic Layer](./logic/)
Message traversal, clustering, priority management.

| Document | Description |
|----------|-------------|
| [Dual-Cursor System](./logic/DUAL-CURSOR-SYSTEM.md) | Working set architecture, pagination, message flow |
| [API Contracts](./logic/API-CONTRACTS.md) | TypeScript interfaces, event contracts |
| [Configuration Reference](./logic/CONFIGURATION.md) | Logic layer configuration options |

### [Presentation Layer](./presentation/)
Visualization, particles, connection lines, shaders.

| Document | Description |
|----------|-------------|
| [Particle System](./presentation/PARTICLE-SYSTEM.md) | Particle rendering, positioning, glow effects |
| [Connection Lines](./presentation/CONNECTION-LINES.md) | Spring physics, catenary curves, gossamer aesthetic |
| [Shader System](./presentation/SHADER-SYSTEM.md) | Cosmic background, foreground layers, breathing |
| [Timing System](./presentation/TIMING-SYSTEM.md) | Message display timing, cluster transitions |
| [Configuration Reference](./presentation/CONFIGURATION.md) | Presentation layer configuration options |

### [Sonification System](./SONIFICATION.md)
Complete audio architecture documentation.

| Topic | Description |
|-------|-------------|
| Philosophical Foundations | Inductive principle, grief doesn't resolve, technology as transparency |
| Baroque Strategies | Figured bass, doctrine of affects, counterpoint without teleology |
| Layer Architecture | Routing, compression, individual layer documentation |
| Configuration | All tunable parameters with defaults |

---

## Quick Start for Developers

### Understanding the Flow

1. **User submits grief message** → Stored in database with semantic embedding
2. **Working set initialized** → 300 messages loaded into memory
3. **Cluster selected** → Focus message + semantically similar messages
4. **Presentation renders** → Particles visible, connections drawn
5. **Cycle advances** → Next message becomes focus, working set refreshes
6. **New submissions prioritized** → Appear within 1-3 cluster cycles (20-60 seconds)

### Key Files

```
lib/
├── config/
│   ├── message-pool-config.ts     # Logic layer configuration
│   ├── visualization-config.ts    # Presentation configuration  
│   └── spring-physics-config.ts   # Connection line physics
├── services/
│   ├── message-logic-service.ts   # Main orchestrator
│   ├── message-pool-manager.ts    # Dual-cursor pagination
│   ├── cluster-selector.ts        # Similarity-based clustering
│   └── database-service.ts        # Supabase integration
├── physics/
│   ├── spring-physics-update.ts   # Connection line animation
│   └── spring-physics-utils.ts    # Catenary curve utilities
└── semantic-encoding.ts           # Anthropic API integration

app/
└── installation/
    └── page.tsx                   # Main visualization (p5.js)
```

### Configuration Priority

When tuning the system, changes propagate from configuration files without code modifications:

1. **Environment Variables** → Override defaults for deployment
2. **Config Files** → Define defaults and validation ranges
3. **Code** → Consumes configuration, never hardcodes values

---

## How Technical Decisions Support the Vision

Throughout this documentation, you'll see explanations of *why* specific implementations were chosen. Every significant decision connects back to the aesthetic philosophy:

| Technical Choice | Aesthetic Purpose |
|-----------------|-------------------|
| Stationary particles | Votive candles don't move; stillness invites contemplation |
| Catenary curves for connection lines | Natural hanging curves feel organic, not engineered |
| Spring physics with high damping | Slow, gentle motion—the system breathes, doesn't jitter |
| Semantic clustering | Reveals hidden kinship between isolated grief experiences |
| 20-second cluster duration | Contemplative pacing—time to read, absorb, reflect |
| Priority queue for new submissions | User's contribution appears quickly, honoring their participation |
| Working set architecture | Bounded memory ensures stability during extended viewing |

---

*Documentation last updated: January 2026*
