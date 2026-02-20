# P5.js Constellation Presentation Layer

A contemplative, museum-quality visualization of grief messages as a particle constellation with semantic connections. Designed for The House of Mourning exhibition at Truss House, Denver (December 19-20, 2025).

## Aesthetic Vision

**Contemporary sacred space.** A secular recreation of lighting a votive candle in a gothic cathedral. Technology so transparent that visitors encounter grief itself—luminous, interconnected, moving through space with organic intelligence.

### Reference Works
- **Nonotak:** Geometric precision, architectural light, immersive environments
- **teamLab:** Fluid organic movement, seamless transitions, room-scale experience
- **Onformative:** Data-driven poetry, algorithmic beauty, technical excellence

## Technical Architecture

### Three-Tier Implementation

**TIER 1: THE THRESHOLD (Foundation)**
- Particle system (400-800 grief messages as luminous points)
- Basic 3D camera controls
- Particle-to-message reveal interaction
- Minimal, elegant visual language

**TIER 2: THE WEB (Emergent Meaning)**
- Semantic connection lines between related messages
- Spring physics for organic billowing
- Connection strength visualization
- Network emergence patterns

**TIER 3: THE CATHEDRAL (Sacred Polish)**
- 3D Perlin noise fluid field
- Camera movement along connection paths
- Advanced shader effects
- Performance optimization

## File Structure

```
p5-constellation/
├── index.tsx                 # Main React component, p5 sketch setup
├── types.ts                  # TypeScript interfaces
├── ParticleSystem.ts         # Core particle management (Tier 1)
├── ConstellationNetwork.ts   # Semantic connection rendering (Tier 2)
├── FluidField.ts             # 3D Perlin noise forces (Tier 3)
├── CameraController.ts       # Orbital camera movement (Tier 3)
├── TextRevealer.ts           # Interactive message display (Tier 3)
├── BackgroundField.ts        # Depth-creating star field (Tier 3)
└── utils/
    ├── vector-math.ts        # 3D vector operations
    └── spring-physics.ts     # Spring-based animation
```

## Dependencies

- `p5` - Creative coding library
- `@types/p5` - TypeScript definitions
- React 18+ (already in project)

Install:
```bash
npm install p5 @types/p5
```

## Development

### Running Locally

```bash
npm run dev
```

Navigate to: `http://localhost:3001/installation`

### Key Concepts

**Working Set Synchronization:**
The particle system stays in sync with the business logic's working set:

```typescript
const workingSet = orchestrator.getWorkingSet()
particles.syncWithWorkingSet(workingSet)
```

New messages fade in. Removed messages fade out. The universe is always 400-800 particles.

**Semantic Clustering:**
Connections are drawn between messages with similarity > 0.6:

```typescript
const clusters = orchestrator.getCurrentClusters()
network.syncWithClusters(clusters)
```

**Frame Loop:**
```typescript
p.draw = () => {
  p.background(0, 0, 5) // Deep space
  
  // Sync with business logic
  particles.syncWithWorkingSet(orchestrator.getWorkingSet())
  network.syncWithClusters(orchestrator.getCurrentClusters())
  
  // Update physics
  particles.update()
  network.update()
  
  // Render (order matters)
  network.render()  // Lines behind particles
  particles.render()
}
```

## Visual Specifications

### Colors
- **Base palette:** Cool blues (HSL: 210°, 60%, 70%)
- **Semantic variation:** ±15° hue shift based on embedding dimensions
- **Background:** Near-black (HSL: 0°, 0%, 5%)
- **Connections:** White at 10-40% opacity based on strength

### Motion
- **Particle velocity:** 0.5-1.0 units/frame (slow drift)
- **Camera orbit:** 0.0005 radians/frame (imperceptible)
- **Spring damping:** 0.9 (smooth, organic billowing)
- **Fluid forces:** 0.1 strength (subtle cosmic currents)

### Sizing
- **Base particle:** 6px diameter
- **New submission:** 12px diameter (fades to 6px over 60 frames)
- **Connection lines:** 0.5px stroke weight
- **Text reveal:** 18px Inter font, 300px max width

## Performance Targets

- **60fps sustained** with 800 particles + 1000 connections
- **<100ms** interaction response time
- **Memory-bounded** (no leaks over 48-hour exhibition)
- **Works on projection hardware** (gallery computers, not high-end gaming rigs)

## Configuration

Located in `types.ts`:

```typescript
export const CONFIG = {
  PARTICLE_BASE_SIZE: 6,
  PARTICLE_NEW_SIZE: 12,
  PARTICLE_VELOCITY_MAX: 1.0,
  CONNECTION_MIN_SIMILARITY: 0.6,
  CONNECTION_STROKE_WEIGHT: 0.5,
  CAMERA_ORBIT_SPEED: 0.0005,
  FLUID_FORCE_STRENGTH: 0.1,
  // ... etc
}
```

## Testing

Run visualization tests:
```bash
npm run test:presentation
```

Manual QA checklist:
- [ ] 60fps with full working set
- [ ] Messages fade in smoothly
- [ ] Connections billow organically
- [ ] Camera movement is contemplative
- [ ] Text reveals without breaking immersion
- [ ] No memory leaks over 1 hour

## Deployment

The presentation runs in production at:
```
https://thehouseofmourning.com/installation
```

Vercel automatically builds and deploys from the `main` branch.

## Exhibition Setup

### On-Site at Truss House

1. **Hardware:**
   - Projection system (1920x1080 minimum)
   - Gallery computer running Chrome
   - Tablet for message submissions (optional)

2. **Launch:**
   - Navigate to `/installation`
   - Enter fullscreen (F11)
   - Let system warm up (30 seconds for working set to populate)

3. **Monitoring:**
   - Check browser console for errors
   - Watch frame rate (should stay 58-60fps)
   - Test message submission every hour

4. **Emergency Procedures:**
   - Hard refresh: Cmd+Shift+R
   - Fallback: Static image slideshow (in `/public/fallback/`)

## Future Enhancements

Potential additions after December exhibition:

- Audio integration (Tier 4: soundscape generation)
- Multi-display support (wrap around gallery walls)
- VR adaptation (Oculus Quest version)
- Recording/replay mode (capture specific constellation states)
- User-configurable aesthetic parameters

## Credits

**Design & Development:** VI Gorish (Two Flaneurs)  
**Production:** Lee Knight (Two Flaneurs)  
**Support:** RiNo Arts District Grant  
**Visual Reference:** Nonotak, teamLab, Onformative

---

For business logic API documentation, see `/lib/services/README.md`  
For creating alternative presentations, see `/presentations/README.md`
