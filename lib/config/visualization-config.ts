/**
 * Visualization Configuration
 *
 * Presentation layer settings for particle animations, connection lines,
 * colors, and timing. These values are independent from business logic
 * but synchronized with cluster duration for smooth transitions.
 */

import { DEFAULT_CONFIG } from './message-pool-config'

/**
 * RGB Color type for shader uniforms
 */
export interface RGBColor {
  r: number
  g: number
  b: number
}

/**
 * Cosmic Shader Configuration
 */
export interface CosmicShaderConfig {
  // Overall brightness multiplier (0.0 - 1.0, default 0.3)
  brightness: number
  
  // Purple/blue tint color (RGB 0-1 range for shader)
  tintColor: RGBColor
  
  // Animation speed multipliers
  animationSpeedX: number
  animationSpeedY: number
  
  // Noise scale - lower = larger cloud structures
  noiseScale: number
  
  // Contrast multiplier for cloud definition
  contrast: number
  
  // Tone mapping intensity
  toneMapping: number
}

/**
 * Foreground Shader Configuration
 * Similar to cosmic shader but renders with alpha transparency
 * so particles show through the voids
 */
export interface ForegroundShaderConfig extends CosmicShaderConfig {
  // Whether foreground shader is enabled
  enabled: boolean
}

/**
 * Dark Overlay Configuration
 * A semi-transparent layer between background shader and particles
 * Allows brighter shader while maintaining dark overall aesthetic
 */
export interface DarkOverlayConfig {
  // Overlay color (RGB 0-255)
  color: RGBColor
  
  // Opacity (0.0 = transparent, 1.0 = fully opaque)
  opacity: number
}

/**
 * Particle Color Configuration (RGBA 0-255 range)
 */
export interface ParticleColorConfig {
  // Center of glow gradient
  center: RGBColor
  // Mid-range of glow gradient  
  mid: RGBColor
}

/**
 * Visualization Config Type
 */
export interface VisualizationConfig {
  // Timing (all values in milliseconds)
  cycleDuration: number
  animateIn: number
  animateOut: number
  animateOutCushion: number
  
  // Focus-Next Connection Styling
  focusColor: string
  connectionFocusCushion: number
  connectionFocusDuration: number
  
  // Default Connection Styling
  defaultConnectionColor: string
  defaultConnectionOpacity: number
  defaultConnectionWidth: number
  
  // Focus-Next Connection Styling (when red)
  focusConnectionOpacity: number
  focusConnectionWidth: number
  
  // Particle Styling
  defaultParticleColor: string
  focusParticleColor: string
  
  // Background color (RGB 0-255)
  backgroundColor: RGBColor
  
  // Cosmic shader settings (background layer)
  cosmicShader: CosmicShaderConfig
  
  // Dark overlay between background shader and particles
  darkOverlay: DarkOverlayConfig
  
  // Foreground shader settings (rendered over particles with alpha)
  foregroundShader: ForegroundShaderConfig
  
  // Particle glow colors (RGB 0-255)
  particleColors: {
    default: ParticleColorConfig
    focus: ParticleColorConfig
  }
  
  // Connection line colors (RGB 0-255)
  connectionColors: {
    default: RGBColor
    focus: RGBColor
  }
}

/**
 * Default Visualization Settings
 *
 * Optimized for contemplative, cathedral-like aesthetic.
 * Slow, gentle animations that encourage stillness and reflection.
 */
export const VISUALIZATION_CONFIG: VisualizationConfig = {
  // ===== TIMING =====
  // Import cluster duration from business logic (single source of truth)
  cycleDuration: DEFAULT_CONFIG.clusterDuration, // 20000ms = 20 seconds
  
  // Animation durations
  animateIn: 3000,           // 3 seconds fade in for connections and particles
  animateOut: 3000,          // 3 seconds fade out for connections and particles
  animateOutCushion: 4000,   // Start fade out at N-4 seconds for connection lines
  
  // ===== FOCUS-NEXT CONNECTION TIMING =====
  // When the current focus-next line turns red (before cluster transition)
  connectionFocusCushion: 6000,  // Turn red at N-6 seconds (with 3s fade)
  
  // How long the incoming focus-next line stays red (after cluster transition)
  connectionFocusDuration: 6000,  // Stay red for 6 seconds (then 3s fade back)
  
  // ===== COLORS (legacy string names) =====
  // Focus particle and focus-next connection line color
  focusColor: 'red',
  
  // Default connection line color
  defaultConnectionColor: 'purple',
  
  // Default particle color
  defaultParticleColor: 'yellow',
  
  // Red variant for focus particles
  focusParticleColor: 'red',
  
  // ===== OPACITY & STROKE =====
  // Default connection line styling
  defaultConnectionOpacity: 0.6,  // INCREASED from 0.15 - start visible, boost on message
  defaultConnectionWidth: 2,      // DOUBLED from 1 - thicker base lines
  
  // Focus-next connection line styling (when red)
  focusConnectionOpacity: 0.8,    // INCREASED from 0.25 - red lines should be very visible
  focusConnectionWidth: 6,        // DOUBLED from 3 - thicker focus lines
  
  // ===== BACKGROUND =====
  // Deep purple-black background
  backgroundColor: { r: 10, g: 5, b: 20 },
  
  // ===== COSMIC SHADER (BACKGROUND) =====
  cosmicShader: {
    // Overall brightness (0.0-1.0) - higher = brighter nebula
    // Increased from 0.3 to allow more definition (darkOverlay controls final darkness)
    brightness: 0.4,
    
    // Purple/blue tint (RGB 0-1 for shader)
    tintColor: { r: 0.3, g: 0.2, b: 1.0 },
    
    // Animation speed - higher = faster cloud movement
    animationSpeedX: 0.15,
    animationSpeedY: 0.126,
    
    // Noise scale - lower = larger cloud structures
    noiseScale: 3.0,
    
    // Contrast - higher = more defined clouds
    contrast: 5.5,
    
    // Tone mapping - higher = more compressed dynamic range
    toneMapping: 2.5,
  },
  
  // ===== DARK OVERLAY =====
  // Semi-transparent layer between background shader and particles
  // Allows bright, defined shader while maintaining dark aesthetic
  darkOverlay: {
    color: { r: 0, g: 0, b: 0 }, // original value: { r: 10, g: 5, b: 30 }
    opacity: 0.4,  // 0 = no overlay, 1 = fully opaque
  },
  
  // ===== FOREGROUND SHADER =====
  // Subtle atmospheric layer over particles for depth
  foregroundShader: {
    enabled: true,
    
    // Very low brightness - just adds subtle texture
    brightness: 0.18,
    
    // Slightly different tint for depth separation
    tintColor: { r: 0.2, g: 0.15, b: 0.8 },
    
    // Slower animation than background
    animationSpeedX: 0.08,
    animationSpeedY: 0.06,
    
    // Larger cloud structures (lower scale)
    noiseScale: 2.0,
    
    // Lower contrast for softer effect
    contrast: 4.0,
    
    // Tone mapping
    toneMapping: 2.0,
  },
  
  // ===== PARTICLE GLOW COLORS (RGB 0-255) =====
  particleColors: {
    // Default yellow/warm particles
    default: {
      center: { r: 255, g: 220, b: 140 },
      mid: { r: 255, g: 200, b: 120 },
    },
    // Focus/highlighted red particles
    focus: {
      center: { r: 255, g: 100, b: 80 },
      mid: { r: 255, g: 90, b: 70 },
    },
  },
  
  // ===== CONNECTION LINE COLORS (RGB 0-255) =====
  connectionColors: {
    // Default purple connection lines
    default: { r: 200, g: 180, b: 255 },
    // Focus-next red connection lines
    focus: { r: 255, g: 120, b: 100 },
  },
}

/**
 * Get timing values in seconds (for easier readability in logs)
 */
export function getTimingInSeconds() {
  return {
    cycleDuration: VISUALIZATION_CONFIG.cycleDuration / 1000,
    animateIn: VISUALIZATION_CONFIG.animateIn / 1000,
    animateOut: VISUALIZATION_CONFIG.animateOut / 1000,
    animateOutCushion: VISUALIZATION_CONFIG.animateOutCushion / 1000,
    connectionFocusCushion: VISUALIZATION_CONFIG.connectionFocusCushion / 1000,
    connectionFocusDuration: VISUALIZATION_CONFIG.connectionFocusDuration / 1000,
  }
}

/**
 * Calculate derived timing values
 */
export function getAnimationTimeline() {
  const { cycleDuration, animateIn, animateOut, animateOutCushion, connectionFocusCushion, connectionFocusDuration } = VISUALIZATION_CONFIG
  
  const cycleSeconds = cycleDuration / 1000
  
  return {
    // When things happen in the cycle (in seconds)
    particleFadeInEnd: animateIn / 1000,
    connectionFadeInEnd: animateIn / 1000,
    
    connectionFadeOutStart: cycleSeconds - (animateOutCushion / 1000),
    connectionFadeOutEnd: cycleSeconds - (animateOutCushion / 1000) + (animateOut / 1000),
    
    focusNextTurnsRedStart: cycleSeconds - (connectionFocusCushion / 1000),
    focusNextTurnsRedEnd: cycleSeconds - (connectionFocusCushion / 1000) + (animateIn / 1000),
    
    // After cluster transition
    incomingFocusNextStaysRedUntil: connectionFocusDuration / 1000,
    incomingFocusNextFadesBackStart: connectionFocusDuration / 1000,
    incomingFocusNextFadesBackEnd: (connectionFocusDuration / 1000) + (animateOut / 1000),
  }
}
