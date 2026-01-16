'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Orchestrator } from '@/presentations/p5-constellation/lib/Orchestrator'
import type { FocusState } from '@/presentations/p5-constellation/lib/Orchestrator'
import type { GriefMessage } from '@/types/grief-messages'
import { VISUALIZATION_CONFIG } from '@/lib/config/visualization-config'
import { positionMessages, type ParticleInfo, type ConnectionInfo, type MessageToPlace, type PlacedMessage } from '@/lib/message-positioning'
import { getDeviceConfig, type DeviceConfig } from '@/lib/device-detection'
import { ConnectionLinePhysics } from '@/lib/types/spring-physics'
import { DEFAULT_SPRING_PHYSICS_CONFIG } from '@/lib/config/spring-physics-config'
import {
  initializeConnectionPhysics,
  updateLineGeometry,
  calculateControlPointPosition,
  applyCoupling
} from '@/lib/physics/spring-physics-utils'
import { updateControlPointPhysics, applyControlPointSeparation } from '@/lib/physics/spring-physics-update'
import {
  sampleFlowFieldForConnection,
  smoothForces
} from '@/lib/physics/flow-field-sampling'
import { debug } from '@/lib/debug-utils'
import { SonificationService } from '@/lib/audio/sonification-service'
import type { MessageCluster } from '@/lib/audio/types'
import SoundControl from '@/components/SoundControl'
import AudioDebugMixer from '@/components/AudioDebugMixer'

const vertexShader = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
`

const cosmicFragmentShader = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

// Configurable uniforms from visualization-config.ts
uniform float u_brightness;      // Overall output brightness (0.0-1.0)
uniform vec3 u_tintColor;        // Purple/blue tint RGB (0-1 range)
uniform float u_animSpeedX;      // Animation speed X
uniform float u_animSpeedY;      // Animation speed Y
uniform float u_noiseScale;      // Noise scale (lower = larger clouds)
uniform float u_contrast;        // Contrast multiplier
uniform float u_toneMapping;     // Tone mapping intensity

varying vec2 vTexCoord;

#define NUM_OCTAVES 4

float random(vec2 pos) {
    return fract(sin(dot(pos.xy, vec2(13.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 pos) {
    vec2 i = floor(pos);
    vec2 f = fract(pos);
    float a = random(i + vec2(0.0, 0.0));
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 pos) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < NUM_OCTAVES; i++) {
        float dir = mod(float(i), 2.0) > 0.5 ? 1.0 : -1.0;
        v += a * noise(pos - 0.1 * dir * u_time * 2.0);
        pos = rot * pos * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 p = (gl_FragCoord.xy * u_noiseScale - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    p -= vec2(-12.0, 0.0);
    
    vec2 q = vec2(0.0);
    q.x = fbm(p + 0.00 * u_time * 2.0);
    q.y = fbm(p + vec2(1.0));

    vec2 r = vec2(0.0);
    r.x = fbm(p + 1.0 * q + vec2(1.7, 1.2) + u_animSpeedX * u_time * 2.0);
    r.y = fbm(p + 1.0 * q + vec2(8.3, 2.8) + u_animSpeedY * u_time * 2.0);

    float f = fbm(p + r);

    vec3 baseCol = mix(vec3(0.0), vec3(1.0), clamp((f * f) * u_contrast, 0.0, 1.0));
    baseCol = mix(baseCol, vec3(1.0), clamp(length(q), 0.0, 1.0));
    baseCol = mix(baseCol, u_tintColor, clamp(r.x, 0.0, 1.0));

    vec3 finalColor = (f * f * f * 1.0 + 0.9 * f) * baseCol;
    vec3 mapped = (finalColor * u_toneMapping) / (1.0 + finalColor * u_toneMapping);

    gl_FragColor = vec4(mapped * u_brightness, 1.0);
}
`

// Foreground shader - same FBM but outputs alpha based on fog density
// Foggy areas are visible, void areas are transparent (particles show through)
const foregroundFragmentShader = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

uniform float u_brightness;
uniform vec3 u_tintColor;
uniform float u_animSpeedX;
uniform float u_animSpeedY;
uniform float u_noiseScale;
uniform float u_contrast;
uniform float u_toneMapping;

varying vec2 vTexCoord;

#define NUM_OCTAVES 4

float random(vec2 pos) {
    return fract(sin(dot(pos.xy, vec2(13.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 pos) {
    vec2 i = floor(pos);
    vec2 f = fract(pos);
    float a = random(i + vec2(0.0, 0.0));
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 pos) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < NUM_OCTAVES; i++) {
        float dir = mod(float(i), 2.0) > 0.5 ? 1.0 : -1.0;
        v += a * noise(pos - 0.1 * dir * u_time * 2.0);
        pos = rot * pos * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    // Offset position slightly for visual separation from background
    vec2 p = (gl_FragCoord.xy * u_noiseScale - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    p -= vec2(-8.0, 2.0);  // Different offset than background
    
    vec2 q = vec2(0.0);
    q.x = fbm(p + 0.00 * u_time * 2.0);
    q.y = fbm(p + vec2(1.0));

    vec2 r = vec2(0.0);
    r.x = fbm(p + 1.0 * q + vec2(1.7, 1.2) + u_animSpeedX * u_time * 2.0);
    r.y = fbm(p + 1.0 * q + vec2(8.3, 2.8) + u_animSpeedY * u_time * 2.0);

    float f = fbm(p + r);

    vec3 baseCol = mix(vec3(0.0), vec3(1.0), clamp((f * f) * u_contrast, 0.0, 1.0));
    baseCol = mix(baseCol, vec3(1.0), clamp(length(q), 0.0, 1.0));
    baseCol = mix(baseCol, u_tintColor, clamp(r.x, 0.0, 1.0));

    vec3 finalColor = (f * f * f * 1.0 + 0.9 * f) * baseCol;
    vec3 mapped = (finalColor * u_toneMapping) / (1.0 + finalColor * u_toneMapping);
    
    // Alpha based on fog density - brighter areas = more fog = more opaque
    float fogDensity = length(mapped);
    float alpha = fogDensity * u_brightness;

    gl_FragColor = vec4(mapped * u_brightness, alpha);
}
`

interface Particle {
  id: string
  x: number
  y: number
  size: number
  message: GriefMessage
  alpha: number
  shouldRemove: boolean
  hoverGlow: number  // 0 to 1, animates smoothly for grow/glow on hover
}

interface Connection {
  fromId: string
  toId: string
  opacity: number
  isOldFocusNext: boolean
  physics?: ConnectionLinePhysics
}

// Re-export PlacedMessage for the component state
type ClusterMessageDisplay = PlacedMessage

// Message timing constants - faster paired cascade
// Pattern: pairs with 1.5s internal offset, pairs are sequential
// R1: 0→4, R2: 1.5→5.5, R3: 4→8, R4: 5.5→9.5, etc.
const MESSAGE_TIMING = {
  // Per-message timing
  fadeInDuration: 1.5,       // Seconds to fade in
  holdDuration: 1.0,         // Seconds at full opacity
  fadeOutDuration: 1.5,      // Seconds to fade out
  // Total per message: 4 seconds
  pairInternalOffset: 1.5,   // Second message in pair starts 1.5s after first
  messageDuration: 4.0,      // Total visibility time per message
  
  // Special message timing
  nextAppearsAt: 23,         // Next message appears at this time (26 - 3)
  focusFadesAt: 24,          // Focus starts fading at this time (26 - 2)
  cycleDuration: 26,         // Total cycle duration in seconds
  outgoingFocusFadeStart: 2, // Old focus fades 2s into new cluster
  
  // Connection line timing
  connectionFadeIn: 2,       // Connections fade in over first 2s
  connectionFadeOutStart: 22,// Connections start fading at 22s
  connectionFadeOutDuration: 2, // Connections fade over 2s
  focusNextTurnsRed: 23,     // Focus-next line turns red at 23s (when next appears)
  incomingRedDuration: 4,    // Incoming red line stays red for 4s after transition
}

function ConnectionsTest() {
  const containerRef = useRef<HTMLDivElement>(null)
  const p5InstanceRef = useRef<any>(null)
  const orchestratorRef = useRef<Orchestrator | null>(null)
  const initialized = useRef(false)
  const deviceConfigRef = useRef<DeviceConfig | null>(null)
  const sonificationRef = useRef<SonificationService | null>(null)

  const [hoveredMessage, setHoveredMessage] = useState<{ content: string; x: number; y: number } | null>(null)
  const [clusterMessages, setClusterMessages] = useState<ClusterMessageDisplay[]>([])
  // SET of IDs to filter from clusterMessages (can have multiple during overlapping transitions)
  const filterIdsRef = useRef<Set<string>>(new Set())
  // PERMANENT position cache - once placed, messages NEVER move
  const positionCacheRef = useRef<Map<string, PlacedMessage>>(new Map())
  const [debugInfo, setDebugInfo] = useState({ 
    fps: 0, 
    renderTime: 0,
    particles: 0,
    connections: 0,
    deviceType: 'detecting' as string,
    gpuRenderer: '' as string,
    memoryMB: 0,
    memoryLimit: 0
  })
  
  // Check for ?debug=true URL parameter
  const [showDebug, setShowDebug] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setShowDebug(params.get('debug') === 'true')
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    
    // Get device-appropriate configuration
    const deviceConfig = getDeviceConfig()
    deviceConfigRef.current = deviceConfig
    debug.log(`[DEVICE] Detected: ${deviceConfig.type}, particles: ${deviceConfig.workingSetSize}, fog: ${deviceConfig.enableForegroundFog}`)
    
    import('p5').then((p5Module) => {
      const p5 = p5Module.default

      if (!containerRef.current) return

      const sketch = (p: any) => {
        let backgroundLayer: any
        let foregroundLayer: any
        let particleLayer: any
        let cosmicShader: any
        let foregroundShader: any
        let shaderTime = 0
        
        // Use device config for particle sizing
        const minParticleSize = deviceConfig.minParticleSize
        const maxParticleSize = deviceConfig.maxParticleSize
        const particleSizeRange = maxParticleSize - minParticleSize
        
        const particles = new Map<string, Particle>()
        const connections: Connection[] = []
        let currentHoveredId: string | null = null
        let orchestrator: Orchestrator
        
        // Explicit cluster timing
        let clusterDuration = 8000
        let clusterStartTime = 0
        let currentFocusId: string | null = null
        let currentNextId: string | null = null
        let previousFocusId: string | null = null
        let previousNextId: string | null = null  // Track for transition continuity
        
        // Track visible messages for particle highlighting
        const visibleMessageOpacities = new Map<string, number>()
        
        // ID of the outgoing focus - kept for filtering from related messages
        // This persists until the NEXT cluster transition
        let outgoingFocusId: string | null = null
        
        // Position cache for next→focus transition continuity
        // When next becomes focus, it should stay in exact same position
        let cachedNextPosition: PlacedMessage | null = null
        
        // Live tracking of current focus position (updated every frame, used to capture outgoing position)
        let currentFocusLivePosition: PlacedMessage | null = null
        
        // Track current cluster message IDs for display
        // messageIndex: -1 for focus, -2 for next, 0-10 for the 11 related messages
        // wasNext: true if this focus was the previous cluster's next (for continuity)
        let currentClusterIds: { id: string; content: string; isFocus: boolean; isNext: boolean; messageIndex: number; wasNext: boolean }[] = []
        
        // One-shot trigger for focus fade (triggers FiguraLayer passus)
        let focusFadeTriggered = false

        p.setup = async () => {
          const canvas = p.createCanvas(p.windowWidth, p.windowHeight)
          canvas.parent(containerRef.current!)
          
          // Background shader layer
          backgroundLayer = p.createGraphics(p.width, p.height, p.WEBGL)
          cosmicShader = backgroundLayer.createShader(vertexShader, cosmicFragmentShader)
          
          // Foreground shader layer - only create on non-mobile devices
          if (deviceConfig.enableForegroundFog) {
            foregroundLayer = p.createGraphics(p.width, p.height, p.WEBGL)
            foregroundShader = foregroundLayer.createShader(vertexShader, foregroundFragmentShader)
          }
          
          // Particle layer (2D canvas for particles and connections)
          particleLayer = p.createGraphics(p.width, p.height)
          
          const supabase = createClient()
          orchestrator = new Orchestrator(supabase, {
            workingSetSize: deviceConfig.workingSetSize,
            clusterSize: 12,
            clusterDuration: MESSAGE_TIMING.cycleDuration * 1000,
            autoCycle: true
          })
          orchestratorRef.current = orchestrator

          // Create sonification service (but don't initialize yet - requires user gesture)
          // SoundControl component will handle initialization on first user click
          if (!sonificationRef.current) {
            sonificationRef.current = new SonificationService()
            debug.log('[AUDIO] Sonification service created (awaiting user gesture)')
          }

          clusterDuration = MESSAGE_TIMING.cycleDuration * 1000

          // STEP 1: API DATA
          orchestrator.onWorkingSetChange((added, removed) => {
            // Add new particles (start faded out)
            added.forEach(msg => {
              if (!particles.has(msg.id)) {
                particles.set(msg.id, {
                  id: msg.id,
                  x: (p.width * 0.01) + Math.random() * (p.width * 0.98),
                  y: (p.height * 0.01) + Math.random() * (p.height * 0.98),
                  size: minParticleSize + Math.random() * particleSizeRange,
                  message: msg,
                  alpha: 0,
                  shouldRemove: false,
                  hoverGlow: 0
                })
              }
            })
            
            // Mark particles for removal
            removed.forEach(id => {
              const particle = particles.get(id)
              if (particle) {
                particle.shouldRemove = true
              }
            })
            
            // Minimal logging
            if (added.length > 0 || removed.length > 0) {
              debug.log(`[WORKING SET] +${added.length} -${removed.length} = ${particles.size} particles (target: ${deviceConfig.workingSetSize})`)
            }
            
            // Warn if particle count is unexpectedly low
            if (particles.size < deviceConfig.workingSetSize * 0.6 && particles.size > 0) {
              debug.warn(`[WARNING] Particle count (${particles.size}) is below expected ${deviceConfig.workingSetSize}`)
            }
          })
          
          orchestrator.onFocusChange((focus: FocusState | null) => {
            // Store previous IDs for tracking transitions
            previousFocusId = currentFocusId
            previousNextId = currentNextId
            
            // Clear the PREVIOUS outgoingFocusId (from 2 clusters ago) - this is where we finally let go
            // The previous outgoingFocusId has had its full fade time in the last cluster
            
            // Track outgoing focus for filtering from related messages
            // We DON'T want the old focus to animate back on as a related message
            if (previousFocusId && focus && focus.focus.id !== previousFocusId) {
              outgoingFocusId = previousFocusId
              filterIdsRef.current.add(previousFocusId)
              // Auto-remove from filter set after fade completes
              const fadeTime = (MESSAGE_TIMING.outgoingFocusFadeStart + MESSAGE_TIMING.fadeOutDuration) * 1000 + 500
              setTimeout(() => {
                filterIdsRef.current.delete(previousFocusId!)
              }, fadeTime)
            } else {
              outgoingFocusId = null
            }
            
            // CRITICAL FIX: Preserve old focus-next connection with its physics state
            // Find the connection that will become the incoming red line
            const oldFocusNextConnection = focus && previousFocusId && focus.focus.id !== previousFocusId
              ? connections.find(c => 
                  (c.fromId === previousFocusId && c.toId === focus.focus.id) ||
                  (c.fromId === focus.focus.id && c.toId === previousFocusId)
                )
              : null
            
            // Clear all connections EXCEPT the one that will persist
            if (oldFocusNextConnection) {
              // Keep only the old focus-next connection (preserves physics state!)
              connections.length = 0
              connections.push(oldFocusNextConnection)
              // Mark it as old focus-next
              oldFocusNextConnection.isOldFocusNext = true
              // Ensure it starts at full opacity
              oldFocusNextConnection.opacity = 1.0
            } else {
              // No connection to preserve, clear everything
              connections.length = 0
            }
            
            // Reset cluster timer
            clusterStartTime = Date.now()
            focusFadeTriggered = false  // Reset focus fade trigger for new cluster
            
            if (focus) {
              currentFocusId = focus.focus.id
              currentNextId = focus.next?.id || null
              
              // Check if this focus was the previous next (for transition continuity)
              const focusWasNext = focus.focus.id === previousNextId
              
              // Track IDs of the old focus-next connection (for duplicate avoidance)
              // Note: The connection itself was already preserved above with its physics state
              const oldFocusNextFromId = oldFocusNextConnection ? oldFocusNextConnection.fromId : null
              const oldFocusNextToId = oldFocusNextConnection ? oldFocusNextConnection.toId : null
              
              // Build cluster message list for display
              currentClusterIds = [
                { id: focus.focus.id, content: focus.focus.content, isFocus: true, isNext: false, messageIndex: -1, wasNext: focusWasNext }
              ]
              
              // Related messages - filter out focus, next, AND outgoing focus
              const relatedFiltered = focus.related.filter(rel => 
                rel.message.id !== focus.focus.id && 
                rel.message.id !== focus.next?.id &&
                rel.message.id !== outgoingFocusId
              )
              
              relatedFiltered.forEach((rel, index) => {
                currentClusterIds.push({
                  id: rel.message.id,
                  content: rel.message.content,
                  isFocus: false,
                  isNext: false,
                  messageIndex: index,
                  wasNext: false
                })
              })
              
              // Add "next" message with special index
              if (focus.next) {
                currentClusterIds.push({
                  id: focus.next.id,
                  content: focus.next.content,
                  isFocus: false,
                  isNext: true,
                  messageIndex: -2,
                  wasNext: false
                })
              }
              
              // Add regular connections EXCEPT if they would duplicate isOldFocusNext
              focus.related.forEach(rel => {
                // Check if this connection would duplicate the old focus-next line
                // (either same direction or reverse direction)
                const isDuplicateOfOldFocusNext = 
                  oldFocusNextFromId && oldFocusNextToId && (
                    (focus.focus.id === oldFocusNextFromId && rel.message.id === oldFocusNextToId) ||
                    (focus.focus.id === oldFocusNextToId && rel.message.id === oldFocusNextFromId)
                  )
                
                if (!isDuplicateOfOldFocusNext) {
                  connections.push({
                    fromId: focus.focus.id,
                    toId: rel.message.id,
                    opacity: 0,
                    isOldFocusNext: false
                  })
                }
              })

              // Notify sonification service of cluster change
              if (sonificationRef.current) {
                const cluster: MessageCluster = {
                  focus: focus.focus,
                  next: focus.next || null,
                  related: focus.related
                }
                sonificationRef.current.onClusterChange(cluster)
              }
            } else {
              currentFocusId = null
              currentNextId = null
              currentClusterIds = []
            }
          })
          
          await orchestrator.initialize()
          clusterStartTime = Date.now()
        }

        p.draw = () => {
          const drawStart = performance.now()
          // Apply device-specific shader speed multiplier
          shaderTime += 0.016 * deviceConfig.shaderSpeedMultiplier
          const { backgroundColor: bg } = VISUALIZATION_CONFIG
          p.background(bg.r, bg.g, bg.b)
          
          // Calculate cluster age in seconds
          const clusterAge = (Date.now() - clusterStartTime) / 1000
          
          // Trigger focus fade event for FiguraLayer (one-shot per cluster)
          if (!focusFadeTriggered && clusterAge >= MESSAGE_TIMING.focusFadesAt) {
            focusFadeTriggered = true
            sonificationRef.current?.onFocusFade()
          }
          
          // Background
          const { backgroundColor, cosmicShader: shaderConfig, darkOverlay, foregroundShader: fgConfig } = VISUALIZATION_CONFIG
          backgroundLayer.clear()
          backgroundLayer.background(backgroundColor.r, backgroundColor.g, backgroundColor.b)
          backgroundLayer.shader(cosmicShader)
          
          // Core uniforms
          cosmicShader.setUniform('u_time', shaderTime)
          cosmicShader.setUniform('u_resolution', [backgroundLayer.width, backgroundLayer.height])
          
          // Configurable shader uniforms
          // === SHADER BREATHING (LFO Modulation) ===
          // Multiple overlapping sine waves create organic brightness + alpha oscillation
          // Prime number periods prevent repetitive patterns
          const shaderBreathTime = Date.now() / 1000
          const breath1 = Math.sin(shaderBreathTime * 0.17) * 0.35  // 5.9s period
          const breath2 = Math.sin(shaderBreathTime * 0.11) * 0.25  // 9.1s period  
          const breath3 = Math.sin(shaderBreathTime * 0.07) * 0.15  // 14.3s period
          
          // Combined breathing: ±75% oscillation (very dramatic)
          const bgBreathing = breath1 + breath2 + breath3
          
          // Apply breathing to brightness
          const bgBrightness = shaderConfig.brightness * (1.0 + bgBreathing)
          
          cosmicShader.setUniform('u_brightness', bgBrightness)
          cosmicShader.setUniform('u_tintColor', [shaderConfig.tintColor.r, shaderConfig.tintColor.g, shaderConfig.tintColor.b])
          cosmicShader.setUniform('u_animSpeedX', shaderConfig.animationSpeedX)
          cosmicShader.setUniform('u_animSpeedY', shaderConfig.animationSpeedY)
          cosmicShader.setUniform('u_noiseScale', shaderConfig.noiseScale)
          cosmicShader.setUniform('u_contrast', shaderConfig.contrast)
          cosmicShader.setUniform('u_toneMapping', shaderConfig.toneMapping)
          
          backgroundLayer.noStroke()
          backgroundLayer.rect(-backgroundLayer.width/2, -backgroundLayer.height/2, backgroundLayer.width, backgroundLayer.height)
          backgroundLayer.resetShader()
          
          // Layer 1: Background shader
          p.image(backgroundLayer, 0, 0)
          
          // Layer 2: Dark overlay (semi-transparent to control overall darkness)
          p.noStroke()
          p.fill(darkOverlay.color.r, darkOverlay.color.g, darkOverlay.color.b, darkOverlay.opacity * 255)
          p.rect(0, 0, p.width, p.height)
          
          particleLayer.clear()
          const ctx = particleLayer.drawingContext
          
          // Calculate message visibility FIRST (before particle rendering)
          // This populates visibleMessageOpacities for particle highlighting
          visibleMessageOpacities.clear()
          
          // First, loop through currentClusterIds to set base opacities
          currentClusterIds.forEach(msg => {
            
            let opacity = 0
            
            if (msg.isFocus) {
              // Focus is always visible, fades at focusFadesAt (35s)
              if (msg.wasNext) {
                // If this focus was the previous next, it's already visible - just fade at end
                if (clusterAge >= MESSAGE_TIMING.focusFadesAt) {
                  const fadeProgress = (clusterAge - MESSAGE_TIMING.focusFadesAt) / MESSAGE_TIMING.fadeOutDuration
                  opacity = Math.max(0, 1 - fadeProgress)
                } else {
                  opacity = 1
                }
              } else {
                // New focus fades in at start, fades out at end
                if (clusterAge <= MESSAGE_TIMING.fadeInDuration) {
                  opacity = Math.min(1, clusterAge / MESSAGE_TIMING.fadeInDuration)
                } else if (clusterAge >= MESSAGE_TIMING.focusFadesAt) {
                  const fadeProgress = (clusterAge - MESSAGE_TIMING.focusFadesAt) / MESSAGE_TIMING.fadeOutDuration
                  opacity = Math.max(0, 1 - fadeProgress)
                } else {
                  opacity = 1
                }
              }
            } else if (msg.isNext) {
              // Next message appears at nextAppearsAt (31s) with fade in
              if (clusterAge >= MESSAGE_TIMING.nextAppearsAt) {
                const timeSinceStart = clusterAge - MESSAGE_TIMING.nextAppearsAt
                opacity = Math.min(1, timeSinceStart / MESSAGE_TIMING.fadeInDuration)
              }
            } else {
              // Related messages use paired cascade formula:
              // startTime = 5.5 * floor(index/2) + (index%2 === 1 ? 2 : 0)
              const pairIndex = Math.floor(msg.messageIndex / 2)
              const isSecondInPair = msg.messageIndex % 2 === 1
              const startTime = MESSAGE_TIMING.messageDuration * pairIndex + (isSecondInPair ? MESSAGE_TIMING.pairInternalOffset : 0)
              const endTime = startTime + MESSAGE_TIMING.messageDuration
              
              if (clusterAge >= startTime && clusterAge < endTime) {
                const timeIntoAnimation = clusterAge - startTime
                
                if (timeIntoAnimation < MESSAGE_TIMING.fadeInDuration) {
                  opacity = timeIntoAnimation / MESSAGE_TIMING.fadeInDuration
                } else if (timeIntoAnimation < MESSAGE_TIMING.fadeInDuration + MESSAGE_TIMING.holdDuration) {
                  opacity = 1
                } else {
                  const fadeOutProgress = (timeIntoAnimation - MESSAGE_TIMING.fadeInDuration - MESSAGE_TIMING.holdDuration) / MESSAGE_TIMING.fadeOutDuration
                  opacity = Math.max(0, 1 - fadeOutProgress)
                }
              }
            }
            
            if (opacity > 0.01) {
              visibleMessageOpacities.set(msg.id, opacity)
            }
          })
          
          // Handle outgoing focus opacity for particle highlighting
          if (outgoingFocusId) {
            if (clusterAge >= MESSAGE_TIMING.outgoingFocusFadeStart) {
              const fadeProgress = (clusterAge - MESSAGE_TIMING.outgoingFocusFadeStart) / MESSAGE_TIMING.fadeOutDuration
              const opacity = Math.max(0, 1 - fadeProgress)
              if (opacity > 0.01) {
                visibleMessageOpacities.set(outgoingFocusId, opacity)
              }
            } else {
              // Before fade starts, fully visible
              visibleMessageOpacities.set(outgoingFocusId, 1)
            }
          }
          
          // Update connection opacity based on MESSAGE_TIMING
          const incomingRedFadeEnd = MESSAGE_TIMING.incomingRedDuration + MESSAGE_TIMING.connectionFadeOutDuration
          const connectionFadeOutEnd = MESSAGE_TIMING.connectionFadeOutStart + MESSAGE_TIMING.connectionFadeOutDuration
          
          connections.forEach(conn => {
            const isFocusNext = (conn.fromId === currentFocusId && conn.toId === currentNextId)
            
            if (conn.isOldFocusNext) {
              // Old focus-next line (incoming red line): persists through entire cycle
              // Stays at full opacity, only color changes (handled in rendering below)
              conn.opacity = 1.0
            } else if (isFocusNext) {
              // Current focus-next: stays purple, turns red when next appears
              // Opacity always 1.0, color changes handled in draw code
              conn.opacity = 1.0
            } else {
              // Related connections: fade in at start, fade out near end
              if (clusterAge <= MESSAGE_TIMING.connectionFadeIn) {
                // Animate IN over first 3 seconds
                conn.opacity = Math.min(1, clusterAge / MESSAGE_TIMING.connectionFadeIn)
              } else if (clusterAge >= MESSAGE_TIMING.connectionFadeOutStart && clusterAge < connectionFadeOutEnd) {
                // Animate OUT starting at 33s
                const fadeProgress = (clusterAge - MESSAGE_TIMING.connectionFadeOutStart) / MESSAGE_TIMING.connectionFadeOutDuration
                conn.opacity = Math.max(0, 1 - fadeProgress)
              } else if (clusterAge >= connectionFadeOutEnd) {
                // Fully faded
                conn.opacity = 0
              } else {
                // Fully visible between animations
                conn.opacity = 1.0
              }
            }
          })
          
          // Old focus-next connections are cleared at cluster transition (onFocusChange)
          // No need to remove them here

          // === SPRING PHYSICS UPDATE ===
          const FIXED_DT = 1 / 60  // Fixed timestep for stability
          const physicsConfig = {
            ...DEFAULT_SPRING_PHYSICS_CONFIG,
            flowField: {
              ...DEFAULT_SPRING_PHYSICS_CONFIG.flowField,
              enabled: true  // Enable flow field sampling
            }
          }

          // === GLOBAL COHERENT FORCES ===
          // Make the system breathe as one organism while preserving individual character
          // Multiple overlapping waves create complex, organic coordinated motion
          
          // Time-based global oscillations (slow breathing)
          const globalTime = Date.now() / 1000
          const breathe1 = Math.sin(globalTime * 0.3) * 3  // 3-second period
          const breathe2 = Math.sin(globalTime * 0.19) * 2 // 5-second period (prime number for non-repeating)
          const breathe3 = Math.sin(globalTime * 0.13) * 1.5 // 7-second period
          
          // Spatial wave patterns (creates coordinated movement across space)
          const wavePhase = globalTime * 0.4
          
          connections.forEach(conn => {
            const fromParticle = particles.get(conn.fromId)
            const toParticle = particles.get(conn.toId)

            if (!fromParticle || !toParticle) return

            // Initialize physics if not already done
            if (!conn.physics) {
              conn.physics = initializeConnectionPhysics(fromParticle, toParticle, physicsConfig)
            }

            // Update line geometry (in case particles moved, though they shouldn't)
            updateLineGeometry(conn.physics, fromParticle, toParticle)

            // === SAMPLE FLOW FIELD ===
            // IMPORTANT: Always sample backgroundLayer (present on both mobile and desktop)
            // Do NOT sample foregroundLayer (only exists on desktop, used for fog)
            sampleFlowFieldForConnection(
              { physics: conn.physics },
              backgroundLayer,  // ALWAYS use background - consistent across devices
              particles,
              physicsConfig,
              conn.fromId,
              conn.toId
            )

            // === SMOOTH FORCES ===
            smoothForces(conn.physics.controlPoint1, physicsConfig)
            smoothForces(conn.physics.controlPoint2, physicsConfig)

            // === APPLY GLOBAL COHERENT FORCES ===
            // Calculate line center for spatial wave sampling
            const lineCenterX = (fromParticle.x + toParticle.x) / 2
            const lineCenterY = (fromParticle.y + toParticle.y) / 2
            
            // Spatial waves (creates regions that move together)
            const spatialWave1 = Math.sin(lineCenterX * 0.003 + wavePhase) * 2
            const spatialWave2 = Math.cos(lineCenterY * 0.004 + wavePhase * 0.7) * 1.5
            const spatialWave3 = Math.sin((lineCenterX + lineCenterY) * 0.002 + wavePhase * 1.3) * 1
            
            // Combine global breathing + spatial waves
            const globalPerpendicularForce = breathe1 + breathe2 + breathe3 + spatialWave1 + spatialWave2 + spatialWave3
            const globalParallelForce = (breathe1 * 0.3 + spatialWave2 * 0.5) // Less sliding, more billowing
            
            // Apply to both control points (creates system-wide coherence)
            conn.physics.controlPoint1.perpendicularForce += globalPerpendicularForce
            conn.physics.controlPoint1.parallelForce += globalParallelForce
            
            conn.physics.controlPoint2.perpendicularForce += globalPerpendicularForce * 0.9 // Slightly different for organic variation
            conn.physics.controlPoint2.parallelForce += globalParallelForce * 0.9

            // === APPLY SEPARATION CONSTRAINT ===
            // Prevent control points from bunching up (creates sharp angles)
            applyControlPointSeparation(conn.physics, physicsConfig)

            // Update physics for both control points
            updateControlPointPhysics(conn.physics.controlPoint1, conn.physics, physicsConfig, FIXED_DT)
            updateControlPointPhysics(conn.physics.controlPoint2, conn.physics, physicsConfig, FIXED_DT)

            // Apply coupling if enabled
            if (physicsConfig.coupling.enabled) {
              applyCoupling(conn.physics, physicsConfig)
            }

            // Calculate final rendering positions
            calculateControlPointPosition(conn.physics.controlPoint1, fromParticle, conn.physics)
            calculateControlPointPosition(conn.physics.controlPoint2, fromParticle, conn.physics)
          })

          // Draw connections
          connections.forEach(conn => {
            if (conn.opacity <= 0.01) return
            
            const from = particles.get(conn.fromId)
            const to = particles.get(conn.toId)
            
            if (!from || !to || from.alpha <= 0.01 || to.alpha <= 0.01) return
            
            const isFocusNext = (conn.fromId === currentFocusId && conn.toId === currentNextId)
            
            // === MESSAGE VISIBILITY HIGHLIGHTING ===
            // Highlight lines when their NON-FOCUS endpoint message appears
            // (Focus is always visible, so we only check the OTHER endpoint)
            const nonFocusId = conn.fromId === currentFocusId ? conn.toId : conn.fromId
            const messageOpacity = visibleMessageOpacities.get(nonFocusId) || 0
            
            // DRAMATIC boosts when the related message appears:
            // Brightness: 1.0 (no message) to 3.0 (full message) = 3x brighter
            const brightnessBoost = 1.0 + (messageOpacity * 2.0)
            // Width: 1.0 (no message) to 2.5 (full message) = 2.5x thicker
            const widthBoost = 1.0 + (messageOpacity * 1.5)
            
            // Determine color and style using config values
            const { connectionColors } = VISUALIZATION_CONFIG
            const defaultCol = connectionColors.default
            const focusCol = connectionColors.focus
            let r, g, b, opacity, lineWidth
            
            // Apply device-specific multipliers
            const lineWidthMultiplier = deviceConfig.connectionLineWidth / VISUALIZATION_CONFIG.defaultConnectionWidth
            const opacityMultiplier = deviceConfig.connectionOpacityMultiplier
            
            if (conn.isOldFocusNext) {
              // Old focus-next line: red initially, fades to purple when message disappears
              // Check if outgoing focus message is still visible
              const outgoingStillVisible = outgoingFocusId && clusterAge < MESSAGE_TIMING.outgoingFocusFadeStart
              
              if (outgoingStillVisible) {
                // Red while message visible
                r = focusCol.r; g = focusCol.g; b = focusCol.b
              } else if (clusterAge < MESSAGE_TIMING.outgoingFocusFadeStart + MESSAGE_TIMING.fadeOutDuration) {
                // Fade red → purple over fadeOutDuration
                const fadeProgress = (clusterAge - MESSAGE_TIMING.outgoingFocusFadeStart) / MESSAGE_TIMING.fadeOutDuration
                r = focusCol.r + (defaultCol.r - focusCol.r) * fadeProgress
                g = focusCol.g + (defaultCol.g - focusCol.g) * fadeProgress
                b = focusCol.b + (defaultCol.b - focusCol.b) * fadeProgress
              } else {
                // Purple after message fades
                r = defaultCol.r; g = defaultCol.g; b = defaultCol.b
              }
              
              // Match regular connection styling (not focus styling)
              opacity = VISUALIZATION_CONFIG.defaultConnectionOpacity * opacityMultiplier
              lineWidth = deviceConfig.connectionLineWidth
            } else if (isFocusNext) {
              // Current focus-next: purple initially, turns red when next message appears
              // Line width and opacity stay constant - only color changes
              opacity = VISUALIZATION_CONFIG.defaultConnectionOpacity * opacityMultiplier
              lineWidth = deviceConfig.connectionLineWidth
              
              if (clusterAge < MESSAGE_TIMING.focusNextTurnsRed) {
                // Purple
                r = defaultCol.r; g = defaultCol.g; b = defaultCol.b
              } else if (clusterAge < MESSAGE_TIMING.focusNextTurnsRed + MESSAGE_TIMING.fadeInDuration) {
                // Interpolate purple → red over fadeInDuration (color only)
                const progress = (clusterAge - MESSAGE_TIMING.focusNextTurnsRed) / MESSAGE_TIMING.fadeInDuration
                r = defaultCol.r + (focusCol.r - defaultCol.r) * progress
                g = defaultCol.g + (focusCol.g - defaultCol.g) * progress
                b = defaultCol.b + (focusCol.b - defaultCol.b) * progress
              } else {
                // Red
                r = focusCol.r; g = focusCol.g; b = focusCol.b
              }
            } else {
              // Normal connection: always purple, constant styling
              r = defaultCol.r; g = defaultCol.g; b = defaultCol.b
              opacity = VISUALIZATION_CONFIG.defaultConnectionOpacity * opacityMultiplier
              lineWidth = deviceConfig.connectionLineWidth
            }
            
            // Apply message visibility boosts
            const finalOpacity = opacity * conn.opacity * Math.min(from.alpha, to.alpha) * brightnessBoost
            const finalLineWidth = lineWidth * widthBoost
            
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`
            ctx.lineWidth = finalLineWidth

            ctx.beginPath()
            ctx.moveTo(from.x, from.y)

            // Use physics-driven Bezier curves if physics initialized
            if (conn.physics) {
              const cp1 = conn.physics.controlPoint1
              const cp2 = conn.physics.controlPoint2

              ctx.bezierCurveTo(
                cp1.x, cp1.y,
                cp2.x, cp2.y,
                to.x, to.y
              )
            } else {
              // Fallback to straight line if physics not initialized
              ctx.lineTo(to.x, to.y)
            }

            ctx.stroke()
          })
          
          // Update and draw particles
          const alphaChangePerFrame = 1.0 / ((VISUALIZATION_CONFIG.animateIn / 1000) * 60) // 60 FPS assumed
          
          // Pulse timing for hover effect (matches preview page)
          const hoverPulseTime = Date.now() / 1000
          const hoverPulse = 1 + Math.sin(hoverPulseTime * 2) * 0.15
          
          particles.forEach((particle, id) => {
            const isFocus = id === currentFocusId
            const isNext = id === currentNextId
            const isNextTurningRed = isNext && clusterAge >= MESSAGE_TIMING.focusNextTurnsRed
            const isHovered = id === currentHoveredId
            
            // Smooth hover glow transition
            if (isHovered) {
              particle.hoverGlow = Math.min(1, particle.hoverGlow + 0.1)
            } else {
              particle.hoverGlow = Math.max(0, particle.hoverGlow - 0.05)
            }
            
            // Check if this particle's message is currently visible
            const messageOpacity = visibleMessageOpacities.get(id) || 0
            const hasVisibleMessage = messageOpacity > 0.01
            
            // Handle alpha - ONLY fade out if marked for removal by Orchestrator
            if (particle.shouldRemove) {
              // Fade out over animateOut duration
              particle.alpha = Math.max(0, particle.alpha - alphaChangePerFrame)
              if (particle.alpha <= 0) {
                particles.delete(id)
                return
              }
            } else {
              // Fade in over animateIn duration (or stay at full)
              particle.alpha = Math.min(1, particle.alpha + alphaChangePerFrame)
            }
            
            if (particle.alpha < 0.01) return
            
            // Determine color using config values
            // Highlighted particles (with visible messages) get a brighter, whiter color
            const { particleColors } = VISUALIZATION_CONFIG
            const isSpecial = isFocus || isNextTurningRed
            const glowAmount = particle.hoverGlow
            
            // Base colors - interpolate toward warm white when hovered
            let center, mid
            if (isSpecial) {
              center = particleColors.focus.center
              mid = particleColors.focus.mid
            } else if (hasVisibleMessage || glowAmount > 0.01) {
              // "Burning brightly" - intensified warm white that scales with message opacity OR hover
              // Use whichever intensity is higher (message visibility or hover glow)
              const intensity = Math.max(messageOpacity, glowAmount)
              center = {
                r: particleColors.default.center.r + (255 - particleColors.default.center.r) * intensity * 0.6,
                g: particleColors.default.center.g + (250 - particleColors.default.center.g) * intensity * 0.5,
                b: particleColors.default.center.b + (240 - particleColors.default.center.b) * intensity * 0.3,
              }
              mid = {
                r: particleColors.default.mid.r + (255 - particleColors.default.mid.r) * intensity * 0.5,
                g: particleColors.default.mid.g + (245 - particleColors.default.mid.g) * intensity * 0.4,
                b: particleColors.default.mid.b + (230 - particleColors.default.mid.b) * intensity * 0.25,
              }
            } else {
              center = particleColors.default.center
              mid = particleColors.default.mid
            }
            
            // Size multipliers: grow when hovered, pulse when hovered
            const hoverSizeGrow = 1 + glowAmount * 0.3  // Grow up to 30% on hover
            const hoverSizePulse = 1 + (hoverPulse - 1) * glowAmount  // Pulse only when hovered
            const finalSizeMult = hoverSizeGrow * hoverSizePulse
            
            const sizeBrightness = 0.4 + ((particle.size - 2) / 4) * 0.6
            // Boost brightness when message is visible OR hovered
            const messageBrightness = hasVisibleMessage ? 1 + messageOpacity * 0.3 : 1
            const hoverBrightness = 1 + glowAmount * 0.4  // Brighten up to 40% on hover
            const totalBrightness = particle.alpha * sizeBrightness * messageBrightness * hoverBrightness
            
            const finalSize = particle.size * 2.5 * finalSizeMult
            
            const gradient = ctx.createRadialGradient(
              particle.x, particle.y, 0,
              particle.x, particle.y, finalSize
            )
            
            gradient.addColorStop(0, `rgba(${center.r}, ${center.g}, ${center.b}, ${1.0 * totalBrightness})`)
            gradient.addColorStop(0.4, `rgba(${mid.r}, ${mid.g}, ${mid.b}, ${0.6 * totalBrightness})`)
            gradient.addColorStop(0.7, `rgba(${mid.r}, ${mid.g}, ${mid.b}, ${0.2 * totalBrightness})`)
            gradient.addColorStop(1, `rgba(${mid.r}, ${mid.g}, ${mid.b}, 0)`)
            
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(particle.x, particle.y, finalSize, 0, Math.PI * 2)
            ctx.fill()
          })
          
          // Layer 3: Particle layer (connections and particles)
          p.image(particleLayer, 0, 0)
          
          // Update cluster messages for React display using luxury positioning system
          // Build particle info map for positioning
          const particleInfoMap = new Map<string, ParticleInfo>()
          particles.forEach((particle, id) => {
            if (particle.alpha > 0.01) {
              particleInfoMap.set(id, {
                id: particle.id,
                x: particle.x,
                y: particle.y,
                size: particle.size
              })
            }
          })
          
          // Build connection info for positioning (avoid placing text over lines)
          const connectionInfos: ConnectionInfo[] = connections
            .filter(c => c.opacity > 0.1)
            .map(c => ({ fromId: c.fromId, toId: c.toId }))
          
          // Build messages to place with their opacities
          // NOTE: outgoingFocusDisplay is rendered SEPARATELY - don't add it here!
          const messagesToPlace: MessageToPlace[] = []
          
          // Add current cluster messages (outgoing focus is handled separately)
          currentClusterIds.forEach(msg => {
            // Skip if this is the outgoing focus (already added above)
            // Use outgoingFocusId for the check - it persists even after outgoingFocus is cleared
            if (outgoingFocusId && msg.id === outgoingFocusId) return
            
            const opacity = visibleMessageOpacities.get(msg.id) || 0
            if (opacity < 0.01) return
            messagesToPlace.push({
              id: msg.id,
              content: msg.content,
              isFocus: msg.isFocus,
              isNext: msg.isNext,
              opacity
            })
          })
          
          // OPTIMIZATION: Only recalculate positions when message set changes
          // Create a stable key from visible message IDs
          const visibleIds = messagesToPlace.map(m => m.id).sort().join(',')
          const previousVisibleIds = p.frameCount === 1 ? '' : (p as any)._previousVisibleIds || ''
          const messagesChanged = visibleIds !== previousVisibleIds
          ;(p as any)._previousVisibleIds = visibleIds
          
          let positionedMessages: PlacedMessage[]
          
          if (messagesChanged) {
            // Message set changed - recalculate positions
            positionedMessages = positionMessages(
              messagesToPlace,
              particleInfoMap,
              connectionInfos,
              p.width,
              p.height
            )
            
            // Apply permanent position cache
            positionedMessages = positionedMessages.map(msg => {
              const cached = positionCacheRef.current.get(msg.id)
              if (cached) {
                return {
                  ...cached,
                  opacity: msg.opacity,
                  particleX: msg.particleX,
                  particleY: msg.particleY,
                  isFocus: msg.isFocus,
                  isNext: msg.isNext,
                }
              } else {
                positionCacheRef.current.set(msg.id, { ...msg })
                return msg
              }
            })
            
            // Store for next frame
            ;(p as any)._cachedPositions = positionedMessages
          } else {
            // Message set unchanged - use cached positions, just update opacities
            const cached = (p as any)._cachedPositions || []
            positionedMessages = cached.map((cachedMsg: PlacedMessage) => {
              const currentMsg = messagesToPlace.find(m => m.id === cachedMsg.id)
              return currentMsg ? {
                ...cachedMsg,
                opacity: currentMsg.opacity,
              } : cachedMsg
            })
          }
          
          // Clean up cache - remove entries for messages no longer in working set
          // (This prevents memory leak but keeps positions stable during cluster lifetime)
          const currentIds = new Set(messagesToPlace.map(m => m.id))
          for (const cachedId of positionCacheRef.current.keys()) {
            if (!particleInfoMap.has(cachedId)) {
              positionCacheRef.current.delete(cachedId)
            }
          }
          
          // Position persistence: if focus was previous next, use cached position
          const focusMsg = currentClusterIds.find(m => m.isFocus)
          if (focusMsg?.wasNext && cachedNextPosition && cachedNextPosition.id === focusMsg.id) {
            // Replace the focus position with the cached next position
            positionedMessages = positionedMessages.map(msg => {
              if (msg.id === focusMsg.id) {
                return {
                  ...msg,
                  messageX: cachedNextPosition!.messageX,
                  messageY: cachedNextPosition!.messageY,
                  anchorX: cachedNextPosition!.anchorX,
                  anchorY: cachedNextPosition!.anchorY,
                  width: cachedNextPosition!.width,
                  height: cachedNextPosition!.height,
                  quadrant: cachedNextPosition!.quadrant,
                  textAlign: cachedNextPosition!.textAlign,
                }
              }
              return msg
            })
          }
          
          // Cache the next message's position for the next transition
          const nextMsg = positionedMessages.find(m => m.isNext)
          if (nextMsg) {
            cachedNextPosition = { ...nextMsg }
          }
          
          // Track current focus position EVERY FRAME (used to capture position when it becomes outgoing)
          const currentFocusMsg = positionedMessages.find(m => m.isFocus && m.id === currentFocusId)
          if (currentFocusMsg) {
            currentFocusLivePosition = { ...currentFocusMsg }
          }
          
          // NOTE: outgoing focus is rendered separately via its own React state
          // Do NOT add it to positionedMessages
          
          // Throttle React state updates to every 5 frames for performance (was 3)
          if (p.frameCount % 5 === 0) {
            setClusterMessages(positionedMessages)
          }
          
          // Layer 4: Foreground shader (atmospheric fog over particles)
          // Disabled on mobile for performance
          if (fgConfig.enabled && deviceConfig.enableForegroundFog) {
            foregroundLayer.clear()
            foregroundLayer.shader(foregroundShader)
            
            foregroundShader.setUniform('u_time', shaderTime)
            foregroundShader.setUniform('u_resolution', [foregroundLayer.width, foregroundLayer.height])
            
            // Apply same breathing to foreground layer for coherent pulsing
            const fgBrightness = fgConfig.brightness * (1.0 + bgBreathing)
            const fgAlpha = 1.0 * (1.0 + bgBreathing)  // Foreground alpha (used in shader calculations)
            
            foregroundShader.setUniform('u_brightness', fgBrightness)
            foregroundShader.setUniform('u_tintColor', [fgConfig.tintColor.r, fgConfig.tintColor.g, fgConfig.tintColor.b])
            foregroundShader.setUniform('u_animSpeedX', fgConfig.animationSpeedX)
            foregroundShader.setUniform('u_animSpeedY', fgConfig.animationSpeedY)
            foregroundShader.setUniform('u_noiseScale', fgConfig.noiseScale)
            foregroundShader.setUniform('u_contrast', fgConfig.contrast)
            foregroundShader.setUniform('u_toneMapping', fgConfig.toneMapping)
            
            foregroundLayer.noStroke()
            foregroundLayer.rect(-foregroundLayer.width/2, -foregroundLayer.height/2, foregroundLayer.width, foregroundLayer.height)
            foregroundLayer.resetShader()
            
            p.image(foregroundLayer, 0, 0)
          }
          
          const drawEnd = performance.now()
          
          if (p.frameCount % 30 === 0) {
            // Memory monitoring (Chrome only)
            let memoryMB = 0
            let memoryLimit = 0
            if ((performance as any).memory) {
              const mem = (performance as any).memory
              memoryMB = Math.round(mem.usedJSHeapSize / 1048576) // Convert to MB
              memoryLimit = Math.round(mem.jsHeapSizeLimit / 1048576)
            }
            
            setDebugInfo({
              fps: Math.round(p.frameRate()),
              renderTime: Math.round((drawEnd - drawStart) * 100) / 100,
              particles: particles.size,
              connections: connections.length,
              deviceType: deviceConfig.type,
              gpuRenderer: deviceConfig.gpuRenderer || 'unknown',
              memoryMB,
              memoryLimit
            })
          }
        }

        p.mouseMoved = () => {
          let foundParticle: Particle | null = null
          
          for (const particle of particles.values()) {
            if (particle.alpha <= 0) continue
            
            const dx = p.mouseX - particle.x
            const dy = p.mouseY - particle.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            if (distance <= particle.size * 2.5) {
              foundParticle = particle
              break
            }
          }
          
          const newId = foundParticle ? foundParticle.id : null
          if (newId !== currentHoveredId) {
            currentHoveredId = newId
            setHoveredMessage(foundParticle 
              ? { content: foundParticle.message.content, x: foundParticle.x, y: foundParticle.y }
              : null
            )
          }
          
          return false
        }

        p.windowResized = () => {
          const oldWidth = p.width
          const oldHeight = p.height
          
          p.resizeCanvas(p.windowWidth, p.windowHeight)
          
          particles.forEach(particle => {
            particle.x = (particle.x / oldWidth) * p.width
            particle.y = (particle.y / oldHeight) * p.height
          })
          
          // Recreate graphics layers at new size
          backgroundLayer = p.createGraphics(p.width, p.height, p.WEBGL)
          cosmicShader = backgroundLayer.createShader(vertexShader, cosmicFragmentShader)
          
          // Only recreate foreground if it was enabled
          if (deviceConfig.enableForegroundFog) {
            foregroundLayer = p.createGraphics(p.width, p.height, p.WEBGL)
            foregroundShader = foregroundLayer.createShader(vertexShader, foregroundFragmentShader)
          }
          
          particleLayer = p.createGraphics(p.width, p.height)
        }
      }

      const p5Instance = new p5(sketch)
      p5InstanceRef.current = p5Instance
    })

    return () => {
      orchestratorRef.current?.cleanup()
      sonificationRef.current?.stop()  // Stop and cleanup audio
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove()
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 w-full h-full bg-black">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Sound controls */}
      <SoundControl sonificationService={sonificationRef.current} />

      {/* Audio debug mixer - only shown with ?debug=true */}
      <AudioDebugMixer sonificationService={sonificationRef.current} visible={showDebug} />

      {/* Minimal floating navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <a 
            href="/" 
            className="text-white/80 hover:text-white transition-colors text-sm md:text-base font-light tracking-wide"
            style={{ 
              fontFamily: 'var(--font-logo)',
              textShadow: '0 2px 10px rgba(0,0,0,0.8)' 
            }}
          >
            Requiary
          </a>
          <div className="flex items-center gap-3 md:gap-6">
            <a 
              href="/about" 
              className="text-white/60 hover:text-white transition-colors w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full border border-white/30 hover:border-white/50 hover:bg-white/10"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
              title="About"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </a>
            <a 
              href="/participate" 
              className="text-white/90 hover:text-white transition-colors text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2 rounded border border-white/30 hover:border-white/50 hover:bg-white/10"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
            >
              Share Your Grief
            </a>
          </div>
        </div>
      </nav>
      
      {/* Debug panel - only shown with ?debug=true */}
      {showDebug && (
        <div className="fixed top-16 md:top-20 right-4 md:right-6 font-mono text-xs md:text-sm text-white bg-black/80 backdrop-blur-sm px-3 py-2 md:px-4 md:py-3 rounded-lg border border-white/20 pointer-events-none z-50">
        <div className="space-y-1">
          <div className="text-lg font-bold text-purple-400">CONNECTIONS</div>
          <div className="text-xs text-gray-400 uppercase">{debugInfo.deviceType}</div>
          <div className="text-xs text-gray-500 truncate max-w-[200px]" title={debugInfo.gpuRenderer}>{debugInfo.gpuRenderer}</div>
          <div className="mt-2 pt-2 border-t border-white/20">
            <div>Particles: {debugInfo.particles}</div>
            <div>Connections: {debugInfo.connections}</div>
            <div className="mt-2 pt-2 border-t border-white/10">
              <div>FPS: <span className={debugInfo.fps >= (debugInfo.deviceType === 'mobile' || debugInfo.deviceType === 'desktop-low' ? 25 : 55) ? 'text-green-400' : 'text-yellow-400'}>{debugInfo.fps}</span></div>
              <div>Render: <span className={debugInfo.renderTime < 16 ? 'text-green-400' : 'text-yellow-400'}>{debugInfo.renderTime}ms</span></div>
              {debugInfo.memoryLimit > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div>Memory: <span className={debugInfo.memoryMB < debugInfo.memoryLimit * 0.8 ? 'text-green-400' : 'text-yellow-400'}>{debugInfo.memoryMB}MB</span> / {debugInfo.memoryLimit}MB</div>
                  <div className="text-xs text-gray-400">({Math.round(debugInfo.memoryMB / debugInfo.memoryLimit * 100)}%)</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {hoveredMessage && (() => {
        // Smart positioning: avoid going off-screen on right edge
        const hoverWidth = 320  // Approximate max width
        const hoverPadding = 25
        const isRightEdge = hoveredMessage.x + hoverPadding + hoverWidth > window.innerWidth - 40
        const isBottomEdge = hoveredMessage.y + 100 > window.innerHeight - 60
        
        return (
          <div 
            className="fixed pointer-events-none z-30"
            style={{
              // Position based on edge detection
              left: isRightEdge ? undefined : `${hoveredMessage.x + hoverPadding}px`,
              right: isRightEdge ? `${window.innerWidth - hoveredMessage.x + hoverPadding}px` : undefined,
              top: isBottomEdge ? undefined : `${hoveredMessage.y + hoverPadding}px`,
              bottom: isBottomEdge ? `${window.innerHeight - hoveredMessage.y + hoverPadding}px` : undefined,
              maxWidth: `${hoverWidth}px`,
              textAlign: isRightEdge ? 'right' : 'left',
            }}
          >
            <p 
              className="font-display leading-relaxed italic"
              style={{
                color: 'rgba(160, 155, 170, 0.9)',  // Slightly brighter
                fontSize: 'clamp(1.125rem, 1.5vw, 1.375rem)',  // Larger: was text-base (~1rem)
                textShadow: [
                  '0 0 10px rgba(0, 0, 0, 1)',
                  '0 0 25px rgba(0, 0, 0, 0.95)',
                  '0 0 40px rgba(0, 0, 0, 0.8)',
                  '0 2px 5px rgba(0, 0, 0, 0.9)',
                ].join(', '),
              }}
            >
              "{hoveredMessage.content}"
            </p>
          </div>
        )
      })()}
      
      {/* Cluster messages displayed near their particles */}
      {clusterMessages.map((msg) => {
        // Filter out outgoing focuses
        if (filterIdsRef.current.has(msg.id)) {
          return null
        }
        // Gallery-grade typography: no boxes, just floating text with subtle shadow
        const isFocus = msg.isFocus
        const isNext = msg.isNext
        const isFocusOrNext = isFocus || isNext
        
        // Color palette: warm off-whites
        // Focus and Next are same size, only differ in color/style
        const textColor = isFocus 
          ? 'rgba(250, 247, 242, 0.98)'  // warm cream
          : isNext 
            ? 'rgba(235, 230, 245, 0.92)' // cool lavender (distinct from focus)
            : 'rgba(220, 215, 230, 0.85)' // muted lavender-white
        
        // SAME SIZE for Focus and Next - only related messages are smaller
        const fontSize = isFocusOrNext
          ? 'clamp(1.375rem, 2.5vw, 2.25rem)'  // Same size for both
          : 'clamp(1.125rem, 2vw, 1.75rem)'    // Smaller for related
        
        const fontWeight = isFocus ? 500 : 400
        // Focus and Next = upright, Related = italic
        const fontStyle = isFocusOrNext ? 'normal' : 'italic'
        const letterSpacing = isFocusOrNext ? '0.025em' : '0.02em'
        
        // Stronger multi-layer text shadow for projection legibility
        const textShadow = [
          '0 0 8px rgba(0, 0, 0, 1)',
          '0 0 25px rgba(0, 0, 0, 0.95)',
          '0 0 50px rgba(0, 0, 0, 0.8)',
          '0 3px 6px rgba(0, 0, 0, 0.9)',
        ].join(', ')
        
        return (
          <div
            key={msg.id}
            className="fixed pointer-events-none z-40"
            style={{
              left: `${msg.messageX}px`,
              top: `${msg.messageY}px`,
              width: `${msg.width}px`,
              opacity: msg.opacity,
              // NO position transitions - messages should stay fixed
              transition: 'opacity 0.3s ease-out',
              textAlign: msg.textAlign,
            }}
          >
            <p
              className="font-display"
              style={{
                color: textColor,
                fontSize,
                fontWeight,
                fontStyle,
                letterSpacing,
                textShadow,
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              {msg.content}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default dynamic(() => Promise.resolve(ConnectionsTest), { ssr: false })
