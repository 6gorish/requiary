# Requiary

A contemplative web application transforming anonymous grief messages into a luminous particle constellation with emergent sonification.

---

## The Vision

Requiary creates a **contemporary, secular space for collective witness of grief**. Visitors submit anonymous expressions of loss, which become glowing points of light in a shared cosmos. The system reveals hidden connections between individual experiences through semantic clustering, creating ephemeral constellations that emerge and dissolve like breath.

The application combines:
- **Visual**: Luminous particles representing grief messages, connected by gossamer lines revealing semantic kinship
- **Sonic**: A living soundscape that emerges from the aggregate presence of messages—not a preset ambient bed, but sound generated from the data itself
- **Interactive**: Contributors see their grief join the constellation within moments

---

## Architecture

The system maintains strict separation between layers:

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                          │
│  p5.js WEBGL • Particles • Connection Lines • Shaders       │
│  Web Audio • Multi-layer Sonification • Semantic Mapping    │
└───────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  BUSINESS LOGIC LAYER                                        │
│  Working Set • Dual Cursors • Clustering • Priority Queue   │
└───────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  DATA LAYER                                                  │
│  PostgreSQL • Messages Table • Semantic Embeddings (Claude) │
└───────────────────────────────────────────────────────────────┘
```

---

## Key Features

### Visual System
- Stationary particles (like votive candles—they don't move)
- Warm golden glow using emissive materials
- Connection lines with spring physics and catenary curves
- Cosmic shader background with slow atmospheric breathing
- 20-second cluster cycles revealing semantic relationships

### Sonification System
- **Ground Layer**: Markov chain bass drone (A1 → E2 → D2 → F#2)
- **Cluster Channel**: Detuned oscillator ensemble responding to semantic embeddings
- **Figura Layer**: Baroque-inspired harmonic "sighs" (6→5, 4→3, 2→1 resolutions)
- **Field Layer**: Crossfading ambient texture beds
- **Cantus Layer**: Rare vocal phrases via Markov chain note selection
- **Texture/Shimmer**: Subliminal lo-fi grit and event-triggered punctuation

The sound doesn't "accompany" the visuals—it **emerges from the same data**. Semantic similarity becomes harmonic consonance. The bass state determines the harmonic foundation. Connection strength maps to interval relationships.

### Semantic Clustering
- Claude API generates 10-dimensional embeddings for each grief message
- Cosine similarity reveals thematic connections
- Focus message + related messages form visual and sonic clusters
- New submissions appear within 1-3 cycles (20-60 seconds)

---

## Documentation

Comprehensive documentation in `/docs`:

- **[Main Documentation](./docs/README.md)** - Architecture overview, philosophy, quick start
- **[Sonification System](./docs/SONIFICATION.md)** - Audio architecture, Baroque strategies, layer details
- **[Data Layer](./docs/data/)** - Database schema, semantic encoding
- **[Logic Layer](./docs/logic/)** - Message flow, clustering, API contracts
- **[Presentation Layer](./docs/presentation/)** - Particles, connections, shaders

---

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### Debug Mode

Add `?debug=true` to the installation URL to access:
- Audio mixer with per-channel faders
- Real-time diagnostics
- Parameter adjustment controls

---

## Technical Stack

- **Framework**: Next.js 16 with App Router
- **Visualization**: p5.js with WEBGL
- **Audio**: Web Audio API with custom synthesis
- **Database**: Supabase (PostgreSQL)
- **Semantic AI**: Anthropic Claude API
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

---

## License

All rights reserved.

---

*"The heart of the wise is in the house of mourning."* — Ecclesiastes 7:4
