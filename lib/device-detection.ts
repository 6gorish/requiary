/**
 * Device Detection & Performance Configuration
 * 
 * Provides device-aware settings for optimal performance across
 * desktop, tablet, and mobile devices, including GPU capability detection.
 */

export type DeviceType = 'desktop' | 'desktop-low' | 'tablet' | 'mobile'

export interface DeviceConfig {
  type: DeviceType
  
  // Particle system
  workingSetSize: number
  maxParticleSize: number
  minParticleSize: number
  
  // Shaders
  enableForegroundFog: boolean
  shaderQuality: 'high' | 'medium' | 'low'
  shaderSpeedMultiplier: number  // Multiplier for shader animation speed
  
  // Connection lines
  connectionLineWidth: number
  focusConnectionLineWidth: number
  connectionOpacityMultiplier: number
  
  // Performance
  targetFPS: number
  adaptiveQuality: boolean
  
  // GPU info (for debugging)
  gpuRenderer?: string
}

// Cache GPU detection result
let cachedGPUTier: 'high' | 'low' | null = null
let cachedGPURenderer: string | null = null

/**
 * Detect GPU capability using WebGL renderer string
 * Returns 'low' for integrated Intel/AMD graphics, 'high' for discrete GPUs and Apple Silicon
 */
function detectGPUTier(): { tier: 'high' | 'low', renderer: string } {
  if (cachedGPUTier !== null) {
    return { tier: cachedGPUTier, renderer: cachedGPURenderer || 'unknown' }
  }
  
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { tier: 'high', renderer: 'unknown (SSR)' }
  }
  
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    
    if (!gl) {
      console.warn('[GPU Detection] WebGL not available, assuming low-tier')
      cachedGPUTier = 'low'
      cachedGPURenderer = 'WebGL unavailable'
      return { tier: 'low', renderer: 'WebGL unavailable' }
    }
    
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
    
    if (!debugInfo) {
      console.warn('[GPU Detection] Debug info unavailable, assuming high-tier')
      cachedGPUTier = 'high'
      cachedGPURenderer = 'unknown (no debug info)'
      return { tier: 'high', renderer: 'unknown (no debug info)' }
    }
    
    const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string
    cachedGPURenderer = renderer
    
    console.log('[GPU Detection] Renderer:', renderer)
    
    // Patterns that indicate low-power integrated graphics
    const lowPowerPatterns = [
      /intel.*uhd/i,           // Intel UHD Graphics (common in iMacs, laptops)
      /intel.*hd/i,            // Intel HD Graphics (older)
      /intel.*iris/i,          // Intel Iris (better but still integrated)
      /intel.*graphics/i,      // Generic Intel graphics
      /amd.*radeon.*vega/i,    // AMD integrated Vega (in Ryzen APUs)
      /amd.*radeon.*graphics/i, // AMD integrated graphics
      /mali/i,                 // ARM Mali (mobile/embedded)
      /adreno/i,               // Qualcomm Adreno (mobile)
      /powervr/i,              // PowerVR (mobile/embedded)
      /swiftshader/i,          // Software renderer (very slow)
      /llvmpipe/i,             // Software renderer
      /softpipe/i,             // Software renderer
    ]
    
    // Patterns that indicate high-power GPUs (check these first)
    const highPowerPatterns = [
      /apple.*m[1-9]/i,        // Apple Silicon (M1, M2, M3, etc.)
      /nvidia.*geforce/i,      // NVIDIA GeForce
      /nvidia.*rtx/i,          // NVIDIA RTX
      /nvidia.*gtx/i,          // NVIDIA GTX
      /nvidia.*quadro/i,       // NVIDIA Quadro
      /amd.*radeon.*rx/i,      // AMD Radeon RX (discrete)
      /amd.*radeon.*pro/i,     // AMD Radeon Pro
      /radeon.*[5-7][0-9]{3}/i, // AMD discrete cards (5000-7000 series)
    ]
    
    // Check high-power first (more specific matches)
    for (const pattern of highPowerPatterns) {
      if (pattern.test(renderer)) {
        console.log('[GPU Detection] High-power GPU detected')
        cachedGPUTier = 'high'
        return { tier: 'high', renderer }
      }
    }
    
    // Check low-power patterns
    for (const pattern of lowPowerPatterns) {
      if (pattern.test(renderer)) {
        console.log('[GPU Detection] Low-power GPU detected')
        cachedGPUTier = 'low'
        return { tier: 'low', renderer }
      }
    }
    
    // Default to high if we can't identify (benefit of the doubt)
    console.log('[GPU Detection] Unknown GPU, defaulting to high-tier')
    cachedGPUTier = 'high'
    return { tier: 'high', renderer }
    
  } catch (error) {
    console.error('[GPU Detection] Error:', error)
    cachedGPUTier = 'high'
    cachedGPURenderer = 'error'
    return { tier: 'high', renderer: 'error' }
  }
}

/**
 * Detect device type based on user agent and screen size
 */
export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop'
  
  const userAgent = navigator.userAgent.toLowerCase()
  const screenWidth = window.innerWidth
  
  // Check user agent for mobile indicators
  const isMobileUA = /iphone|ipod|android.*mobile|windows phone|blackberry/i.test(userAgent)
  const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(userAgent)
  
  // Combine with screen size for better accuracy
  if (isMobileUA || screenWidth < 768) {
    return 'mobile'
  }
  
  if (isTabletUA || (screenWidth >= 768 && screenWidth < 1024)) {
    return 'tablet'
  }
  
  // Desktop - check GPU capability
  const { tier } = detectGPUTier()
  if (tier === 'low') {
    return 'desktop-low'
  }
  
  return 'desktop'
}

/**
 * Check if current device is mobile
 */
export function isMobile(): boolean {
  return detectDeviceType() === 'mobile'
}

/**
 * Check if current device is tablet
 */
export function isTablet(): boolean {
  return detectDeviceType() === 'tablet'
}

/**
 * Get device-appropriate configuration
 */
export function getDeviceConfig(): DeviceConfig {
  const deviceType = detectDeviceType()
  const { renderer } = detectGPUTier()
  
  switch (deviceType) {
    case 'mobile':
      return {
        type: 'mobile',
        
        // Significantly reduced particle count
        workingSetSize: 100,
        maxParticleSize: 3,      // Smaller max size
        minParticleSize: 1.5,
        
        // Disable expensive fog shader
        enableForegroundFog: false,
        shaderQuality: 'low',
        shaderSpeedMultiplier: 1.8,  // Faster animation on mobile
        
        // Thicker, more visible connection lines
        connectionLineWidth: 2,
        focusConnectionLineWidth: 4,
        connectionOpacityMultiplier: 1.5,  // Boost opacity
        
        // Lower target, enable adaptive
        targetFPS: 30,
        adaptiveQuality: true,
        gpuRenderer: renderer,
      }
      
    case 'tablet':
      return {
        type: 'tablet',
        
        // Moderate reduction
        workingSetSize: 200,
        maxParticleSize: 4,
        minParticleSize: 1.5,
        
        // Keep fog but at lower quality
        enableForegroundFog: true,
        shaderQuality: 'medium',
        shaderSpeedMultiplier: 1.3,  // Slightly faster on tablet
        
        // Slightly thicker lines
        connectionLineWidth: 1.5,
        focusConnectionLineWidth: 3.5,
        connectionOpacityMultiplier: 1.2,
        
        targetFPS: 45,
        adaptiveQuality: true,
        gpuRenderer: renderer,
      }
    
    case 'desktop-low':
      // Low-power desktop (Intel integrated graphics, etc.)
      // Better than mobile (bigger screen, more CPU) but can't handle full GPU load
      return {
        type: 'desktop-low',
        
        // Reduced particle count
        workingSetSize: 150,
        maxParticleSize: 5,
        minParticleSize: 1.5,
        
        // Disable foreground fog (biggest GPU saver)
        enableForegroundFog: false,
        shaderQuality: 'medium',
        shaderSpeedMultiplier: 1.0,
        
        // Standard line widths
        connectionLineWidth: 1,
        focusConnectionLineWidth: 3,
        connectionOpacityMultiplier: 1.0,
        
        // Target 30fps, enable adaptive
        targetFPS: 30,
        adaptiveQuality: true,
        gpuRenderer: renderer,
      }
      
    case 'desktop':
    default:
      return {
        type: 'desktop',
        
        // Full quality
        workingSetSize: 300,
        maxParticleSize: 6,
        minParticleSize: 2,
        
        enableForegroundFog: true,
        shaderQuality: 'high',
        shaderSpeedMultiplier: 1.0,  // Normal speed on desktop
        
        connectionLineWidth: 1,
        focusConnectionLineWidth: 3,
        connectionOpacityMultiplier: 1.0,
        
        targetFPS: 60,
        adaptiveQuality: false,
        gpuRenderer: renderer,
      }
  }
}

/**
 * Force a specific quality tier (useful for testing or user preference)
 * Pass null to reset to auto-detection
 */
export function overrideGPUTier(tier: 'high' | 'low' | null): void {
  cachedGPUTier = tier
  if (tier === null) {
    cachedGPURenderer = null
  }
}

/**
 * FPS Monitor for adaptive quality
 * 
 * Tracks frame rate and triggers quality reduction if needed.
 */
export class FPSMonitor {
  private samples: number[] = []
  private maxSamples = 60  // 1 second of samples at 60fps
  private lastTime = 0
  private qualityLevel = 1.0  // 1.0 = full quality, 0.5 = reduced
  private targetFPS: number
  private onQualityChange?: (level: number) => void
  
  constructor(targetFPS: number = 30, onQualityChange?: (level: number) => void) {
    this.targetFPS = targetFPS
    this.onQualityChange = onQualityChange
  }
  
  /**
   * Call this every frame with current timestamp
   */
  tick(currentTime: number): void {
    if (this.lastTime > 0) {
      const delta = currentTime - this.lastTime
      const fps = 1000 / delta
      
      this.samples.push(fps)
      if (this.samples.length > this.maxSamples) {
        this.samples.shift()
      }
      
      // Check every 30 frames
      if (this.samples.length >= 30 && this.samples.length % 30 === 0) {
        this.evaluateQuality()
      }
    }
    this.lastTime = currentTime
  }
  
  /**
   * Get current average FPS
   */
  getAverageFPS(): number {
    if (this.samples.length === 0) return 60
    const sum = this.samples.reduce((a, b) => a + b, 0)
    return sum / this.samples.length
  }
  
  /**
   * Get current quality level (0.0 - 1.0)
   */
  getQualityLevel(): number {
    return this.qualityLevel
  }
  
  private evaluateQuality(): void {
    const avgFPS = this.getAverageFPS()
    const oldLevel = this.qualityLevel
    
    if (avgFPS < this.targetFPS * 0.7) {
      // Significantly below target - reduce quality
      this.qualityLevel = Math.max(0.3, this.qualityLevel - 0.1)
    } else if (avgFPS < this.targetFPS * 0.9) {
      // Slightly below target - minor reduction
      this.qualityLevel = Math.max(0.5, this.qualityLevel - 0.05)
    } else if (avgFPS > this.targetFPS * 1.1 && this.qualityLevel < 1.0) {
      // Above target and not at full quality - increase
      this.qualityLevel = Math.min(1.0, this.qualityLevel + 0.05)
    }
    
    if (oldLevel !== this.qualityLevel && this.onQualityChange) {
      this.onQualityChange(this.qualityLevel)
    }
  }
  
  /**
   * Reset monitor state
   */
  reset(): void {
    this.samples = []
    this.lastTime = 0
    this.qualityLevel = 1.0
  }
}
