/**
 * FiguraLayer v2: Subliminal Harmonic Sighs
 * 
 * A contemplative reinterpretation of Baroque affect through
 * glacial harmonic resolutions. Rather than literal melodic figures,
 * this creates distant tonal weather — single suspended tones that
 * slowly resolve to consonances relative to the current tonic.
 * 
 * The gestures are:
 * - 6→5 (major 6th → perfect 5th): Yearning, the most common
 * - 4→3 (perfect 4th → major 3rd): Tender, softer resolution
 * - 2→1 (major 2nd → unison): Arrival, complete resolution (rare)
 * 
 * These happen at geological pace (20-40 seconds per gesture)
 * and are drenched in reverb to place them at the back of the
 * soundstage — felt more than heard. Pure sine waves, very low
 * gain, in the lower octaves (3-4) for environmental presence.
 * 
 * Inspired by Feldman's late works: single events separated by
 * vast silences, where the space around the note matters more
 * than the note itself.
 */

import type { SonificationConfig } from './types'

interface SighDefinition {
  name: string
  startInterval: number    // Semitones above tonic
  endInterval: number      // Resolution target (semitones above tonic)
  description: string
  weight: number           // Probability weight
}

// The three fundamental sighs - all resolve downward
const SIGH_DEFINITIONS: SighDefinition[] = [
  { 
    name: 'yearning', 
    startInterval: 9,   // Major 6th (la)
    endInterval: 7,     // Perfect 5th (sol)
    description: '6→5, la resolving to sol',
    weight: 0.5         // Most common
  },
  { 
    name: 'tender', 
    startInterval: 5,   // Perfect 4th (fa)
    endInterval: 4,     // Major 3rd (mi)
    description: '4→3, fa resolving to mi',
    weight: 0.35
  },
  { 
    name: 'arrival', 
    startInterval: 2,   // Major 2nd (re)
    endInterval: 0,     // Unison (do)
    description: '2→1, re resolving to do',
    weight: 0.15        // Rare, complete resolution
  },
]

interface ActiveSigh {
  definition: SighDefinition
  startTime: number
  tonicHz: number
  oscillator: OscillatorNode
  gainNode: GainNode
  phase: 'suspend' | 'resolve' | 'decay'
  totalDuration: number
  phaseTimeouts: Set<NodeJS.Timeout>  // Track phase timeouts for cleanup
}

interface SighConfig {
  gain: number                    // Output gain (very low: 0.04-0.08)
  baseOctave: number              // Base octave (3-4 for environmental)
  
  // Timing (glacial)
  suspendDuration: number         // How long to hold the suspended note (8-15s)
  resolveDuration: number         // How long the glide to resolution takes (6-12s)
  decayDuration: number           // How long the resolved note decays (8-15s)
  
  // Envelope
  attackTime: number              // Fade in time (4-8s)
  releaseTime: number             // Fade out time (6-10s)
  
  // Trigger intervals
  randomIntervalMin: number       // Minimum time between random sighs (60s)
  randomIntervalMax: number       // Maximum time between random sighs (120s)
  
  // Probabilities
  onClusterChange: number         // Chance on cluster change (0.3)
  onFocusFade: number             // Chance when focus fades (0.5)
}

const DEFAULT_SIGH_CONFIG: SighConfig = {
  gain: 0.05,                     // Very quiet - subliminal
  baseOctave: 3,                  // Low for environmental presence
  
  suspendDuration: 12,            // 12 seconds of suspended yearning
  resolveDuration: 8,             // 8 second glide to resolution
  decayDuration: 12,              // 12 seconds of resolved tone decaying
  
  attackTime: 6,                  // 6 second fade in
  releaseTime: 8,                 // 8 second fade out
  
  randomIntervalMin: 70,
  randomIntervalMax: 140,
  
  onClusterChange: 0.25,          // 25% on cluster change
  onFocusFade: 0.45,              // 45% when focus fades
}

export class FiguraLayer {
  private context: AudioContext
  private config: SighConfig
  private outputGain: GainNode
  
  private activeSighs: ActiveSigh[] = []
  private currentTonicHz: number = 220     // A3 default
  private randomTriggerTimeout: NodeJS.Timeout | null = null
  
  // Mixer state
  private baseGain: number
  private isMuted: boolean = false

  constructor(context: AudioContext, figuraConfig: SonificationConfig['figura'], sighConfig: Partial<SighConfig> = {}) {
    this.context = context
    this.config = { ...DEFAULT_SIGH_CONFIG, gain: figuraConfig.gain, ...sighConfig }
    this.baseGain = this.config.gain

    // Create output gain (this goes to the reverb bus for extra wet)
    this.outputGain = context.createGain()
    this.outputGain.gain.value = this.config.gain

    // Start random trigger timer
    this.scheduleRandomTrigger()
    
    console.log('[FiguraLayer] Initialized - subliminal harmonic sighs')
  }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination)
  }

  /**
   * Update the current tonic (called when cluster changes)
   */
  setTonic(hz: number): void {
    this.currentTonicHz = hz
  }

  /**
   * Called when a new cluster begins
   */
  onClusterChange(tonicHz: number): void {
    this.currentTonicHz = tonicHz
    
    if (Math.random() < this.config.onClusterChange) {
      // Prefer yearning (6→5) on cluster change
      const sigh = this.selectSigh()
      this.triggerSigh(sigh, tonicHz)
    }
  }

  /**
   * Called when focus begins fading (end of cluster)
   */
  onFocusFade(tonicHz: number): void {
    this.currentTonicHz = tonicHz
    
    if (Math.random() < this.config.onFocusFade) {
      // Any sigh appropriate for fading
      const sigh = this.selectSigh()
      this.triggerSigh(sigh, tonicHz)
    }
  }

  /**
   * Called when a high-similarity connection forms
   */
  onConnection(similarity: number, tonicHz: number): void {
    // Connections don't trigger sighs in this contemplative version
    // The gesture is too assertive for connection moments
    this.currentTonicHz = tonicHz
  }

  /**
   * Select a sigh based on weighted probability
   */
  private selectSigh(): SighDefinition {
    const totalWeight = SIGH_DEFINITIONS.reduce((sum, s) => sum + s.weight, 0)
    let random = Math.random() * totalWeight
    
    for (const sigh of SIGH_DEFINITIONS) {
      random -= sigh.weight
      if (random <= 0) return sigh
    }
    
    return SIGH_DEFINITIONS[0]  // Fallback to yearning
  }

  /**
   * Trigger a sigh starting from the given tonic
   */
  private triggerSigh(definition: SighDefinition, tonicHz: number): void {
    // Limit concurrent sighs to prevent mudiness
    if (this.activeSighs.length >= 1) {
      console.log('[FiguraLayer] Skipping - sigh already active')
      return
    }

    // Calculate pitches in the configured octave
    // Tonic might be in any octave, so we normalize to our base octave
    const tonicInOctave = this.normalizeToOctave(tonicHz, this.config.baseOctave)
    const startPitch = tonicInOctave * Math.pow(2, definition.startInterval / 12)
    const endPitch = tonicInOctave * Math.pow(2, definition.endInterval / 12)
    
    // Create pure sine oscillator (gentlest timbre)
    const oscillator = this.context.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = startPitch

    // Create gain envelope
    const gainNode = this.context.createGain()
    gainNode.gain.value = 0

    // Connect: osc → gain → output
    oscillator.connect(gainNode)
    gainNode.connect(this.outputGain)

    oscillator.start()

    // Calculate total duration
    const totalDuration = this.config.suspendDuration + 
                          this.config.resolveDuration + 
                          this.config.decayDuration

    // Start fade in with linear ramp for truly gradual entrance
    const now = this.context.currentTime
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(1, now + this.config.attackTime)

    const sigh: ActiveSigh = {
      definition,
      startTime: now,
      tonicHz: tonicInOctave,
      oscillator,
      gainNode,
      phase: 'suspend',
      totalDuration,
      phaseTimeouts: new Set()
    }

    this.activeSighs.push(sigh)
    
    console.log(`[FiguraLayer] Triggered "${definition.name}" (${definition.description}) at ${Math.round(startPitch)}Hz → ${Math.round(endPitch)}Hz`)

    // Schedule phase transitions
    this.schedulePhases(sigh, startPitch, endPitch)
  }

  /**
   * Normalize a frequency to a specific octave
   */
  private normalizeToOctave(hz: number, targetOctave: number): number {
    // A4 = 440Hz, A3 = 220Hz, A2 = 110Hz, etc.
    // Find what octave the current hz is in (relative to A)
    const A4 = 440
    const currentOctave = Math.floor(Math.log2(hz / A4) + 4)
    const octaveDiff = targetOctave - currentOctave
    return hz * Math.pow(2, octaveDiff)
  }

  /**
   * Schedule the three phases: suspend → resolve → decay
   */
  private schedulePhases(sigh: ActiveSigh, startPitch: number, endPitch: number): void {
    const { suspendDuration, resolveDuration, decayDuration, releaseTime } = this.config
    
    // Phase 1: Suspend (already started with fade in)
    // Hold the suspended note
    
    // Phase 2: Resolve (glide to resolution)
    const resolveTimeout = setTimeout(() => {
      sigh.phaseTimeouts.delete(resolveTimeout)
      if (!this.activeSighs.includes(sigh)) return
      sigh.phase = 'resolve'
      
      // Glacial glide to the resolution pitch
      sigh.oscillator.frequency.setTargetAtTime(
        endPitch,
        this.context.currentTime,
        resolveDuration / 3  // Time constant for smooth exponential approach
      )
      
      console.log(`[FiguraLayer] "${sigh.definition.name}" resolving...`)
    }, suspendDuration * 1000)
    sigh.phaseTimeouts.add(resolveTimeout)
    
    // Phase 3: Decay (hold resolved note, then fade out)
    const decayTimeout = setTimeout(() => {
      sigh.phaseTimeouts.delete(decayTimeout)
      if (!this.activeSighs.includes(sigh)) return
      sigh.phase = 'decay'
      
      // Begin fade out partway through decay
      const fadeOutDelay = (decayDuration - releaseTime) * 1000
      const fadeTimeout = setTimeout(() => {
        sigh.phaseTimeouts.delete(fadeTimeout)
        if (!this.activeSighs.includes(sigh)) return
        const fadeNow = this.context.currentTime
        sigh.gainNode.gain.setValueAtTime(sigh.gainNode.gain.value, fadeNow)
        sigh.gainNode.gain.linearRampToValueAtTime(0, fadeNow + releaseTime)
      }, Math.max(0, fadeOutDelay))
      sigh.phaseTimeouts.add(fadeTimeout)
      
      console.log(`[FiguraLayer] "${sigh.definition.name}" decaying...`)
    }, (suspendDuration + resolveDuration) * 1000)
    sigh.phaseTimeouts.add(decayTimeout)
    
    // Cleanup after total duration + some buffer
    const cleanupTimeout = setTimeout(() => {
      sigh.phaseTimeouts.delete(cleanupTimeout)
      this.cleanupSigh(sigh)
    }, (suspendDuration + resolveDuration + decayDuration + 2) * 1000)
    sigh.phaseTimeouts.add(cleanupTimeout)
  }

  /**
   * Clean up a completed sigh
   */
  private cleanupSigh(sigh: ActiveSigh): void {
    // Clear any remaining phase timeouts
    for (const timeout of sigh.phaseTimeouts) {
      clearTimeout(timeout)
    }
    sigh.phaseTimeouts.clear()
    
    try {
      sigh.oscillator.stop()
    } catch (e) { /* ignore */ }
    sigh.oscillator.disconnect()
    sigh.gainNode.disconnect()
    
    const index = this.activeSighs.indexOf(sigh)
    if (index > -1) {
      this.activeSighs.splice(index, 1)
    }
    
    console.log(`[FiguraLayer] "${sigh.definition.name}" completed`)
  }

  /**
   * Schedule random sigh triggers
   */
  private scheduleRandomTrigger(): void {
    const delay = this.config.randomIntervalMin + 
      Math.random() * (this.config.randomIntervalMax - this.config.randomIntervalMin)

    this.randomTriggerTimeout = setTimeout(() => {
      const sigh = this.selectSigh()
      this.triggerSigh(sigh, this.currentTonicHz)
      
      // Schedule next
      this.scheduleRandomTrigger()
    }, delay * 1000)
  }

  // ============================================================
  // MIXER API
  // ============================================================

  getGain(): number {
    return this.baseGain
  }

  setGain(gain: number): void {
    this.baseGain = gain
    if (!this.isMuted) {
      this.outputGain.gain.setTargetAtTime(gain, this.context.currentTime, 0.05)
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted
    this.outputGain.gain.setTargetAtTime(
      muted ? 0 : this.baseGain,
      this.context.currentTime,
      0.05
    )
  }

  /**
   * Get count of currently sounding sighs
   */
  getActiveFiguraCount(): number {
    return this.activeSighs.length
  }

  /**
   * Get names of currently sounding sighs
   */
  getActiveFiguraNames(): string[] {
    return this.activeSighs.map(s => s.definition.name)
  }

  stop(): void {
    if (this.randomTriggerTimeout) {
      clearTimeout(this.randomTriggerTimeout)
      this.randomTriggerTimeout = null
    }
    
    this.activeSighs.forEach(sigh => {
      // Clear phase timeouts
      for (const timeout of sigh.phaseTimeouts) {
        clearTimeout(timeout)
      }
      sigh.phaseTimeouts.clear()
      
      try {
        sigh.oscillator.stop()
      } catch (e) { /* ignore */ }
      sigh.oscillator.disconnect()
      sigh.gainNode.disconnect()
    })
    this.activeSighs = []
  }
}
