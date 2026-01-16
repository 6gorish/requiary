/**
 * Ground Layer: Slow-moving bass oscillator
 * Cycles between bass notes every 2-5 minutes
 */

import type { SonificationConfig } from './types'

// Bass notes: A1=55Hz, D2=73.42Hz, E2=82.41Hz, F#2=92.50Hz
const BASS_NOTES = {
  A1: 55,      // Tonic - home, grounding
  D2: 73.42,   // ^4 - subdominant, plagal weight
  E2: 82.41,   // ^5 - dominant, expectant  
  F_SHARP_2: 92.50  // ^6 - Dorian color, bittersweet warmth
} as const

type BassNote = keyof typeof BASS_NOTES

// Markov transition weights: from -> { to: probability }
// F#2 is rare but when it appears, it gravitates back home
const MARKOV_WEIGHTS: Record<BassNote, Record<BassNote, number>> = {
  A1: { A1: 0.15, D2: 0.35, E2: 0.40, F_SHARP_2: 0.10 },
  D2: { A1: 0.45, D2: 0.00, E2: 0.40, F_SHARP_2: 0.15 },
  E2: { A1: 0.50, D2: 0.35, E2: 0.00, F_SHARP_2: 0.15 },
  F_SHARP_2: { A1: 0.60, D2: 0.10, E2: 0.30, F_SHARP_2: 0.00 }  // Always wants to fall back home
}

export class GroundLayer {
  private context: AudioContext
  private config: SonificationConfig['ground']
  private currentOscillator: OscillatorNode | null = null
  private currentOscillator2: OscillatorNode | null = null
  private currentGain: GainNode | null = null
  private currentGain2: GainNode | null = null
  private outputGain: GainNode
  private currentNote: BassNote = 'A1'
  private transitionTimeout: NodeJS.Timeout | null = null
  private speedMultiplier: number = 1.0  // For testing: higher = faster transitions

  // Mixer state
  private baseGain: number
  private isMuted: boolean = false

  constructor(context: AudioContext, config: SonificationConfig['ground']) {
    this.context = context
    this.config = config
    this.baseGain = config.gain

    this.outputGain = context.createGain()
    this.outputGain.gain.value = config.gain

    this.start()
  }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination)
  }

  private start(): void {
    // Start with tonic
    this.playBassNote(BASS_NOTES[this.currentNote])
    this.scheduleNextTransition()
  }

  private playBassNote(frequency: number): void {
    const now = this.context.currentTime
    const glideTime = 0.05  // 50ms - just enough to avoid clicks, not enough to hear as glide

    // If oscillators already exist, just change their frequency
    if (this.currentOscillator && this.currentOscillator2) {
      this.currentOscillator.frequency.setValueAtTime(this.currentOscillator.frequency.value, now)
      this.currentOscillator.frequency.linearRampToValueAtTime(frequency, now + glideTime)
      
      this.currentOscillator2.frequency.setValueAtTime(this.currentOscillator2.frequency.value, now)
      this.currentOscillator2.frequency.linearRampToValueAtTime(frequency * 2, now + glideTime)
      return
    }

    // First time: create oscillators
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()

    osc.type = 'sine'
    osc.frequency.value = frequency

    // Add a subtle second harmonic for warmth
    const osc2 = this.context.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = frequency * 2
    const gain2 = this.context.createGain()

    osc.connect(gain)
    osc2.connect(gain2)
    gain.connect(this.outputGain)
    gain2.connect(this.outputGain)

    // Fade in on first note (2 second fade in from silence)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + 2)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.linearRampToValueAtTime(0.3, now + 2)

    osc.start(now)
    osc2.start(now)

    this.currentOscillator = osc
    this.currentOscillator2 = osc2
    this.currentGain = gain
    this.currentGain2 = gain2
  }

  private scheduleNextTransition(): void {
    // Apply speed multiplier: higher = faster (shorter duration)
    const baseMin = this.config.stateMinDuration / this.speedMultiplier
    const baseMax = this.config.stateMaxDuration / this.speedMultiplier
    const duration = baseMin + Math.random() * (baseMax - baseMin)

    this.transitionTimeout = setTimeout(() => {
      // Markov chain: pick next bass note based on weighted transitions
      const nextNote = this.pickNextBassNote()
      this.currentNote = nextNote
      this.playBassNote(BASS_NOTES[nextNote])
      this.scheduleNextTransition()
    }, duration)
  }

  private pickNextBassNote(): BassNote {
    const weights = MARKOV_WEIGHTS[this.currentNote]
    const rand = Math.random()
    let cumulative = 0
    
    for (const [note, probability] of Object.entries(weights)) {
      cumulative += probability
      if (rand < cumulative) {
        return note as BassNote
      }
    }
    
    // Fallback to tonic (shouldn't happen if weights sum to 1)
    return 'A1'
  }

  getCurrentBassFrequency(): number {
    return BASS_NOTES[this.currentNote]
  }

  getCurrentBassNoteName(): string {
    // Return human-readable note name
    switch (this.currentNote) {
      case 'A1': return 'A1'
      case 'D2': return 'D2'
      case 'E2': return 'E2'
      case 'F_SHARP_2': return 'F#2'
    }
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
   * Set bass cycle speed multiplier for testing
   * 1.0 = normal (2-5 min), 10.0 = 10x faster (12-30 sec), etc.
   */
  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(100, multiplier))
    // Reschedule next transition with new timing
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout)
      this.scheduleNextTransition()
    }
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplier
  }

  stop(): void {
    if (this.transitionTimeout) clearTimeout(this.transitionTimeout)
    try {
      this.currentOscillator?.stop()
      this.currentOscillator?.disconnect()
    } catch (e) { /* ignore */ }
    try {
      this.currentOscillator2?.stop()
      this.currentOscillator2?.disconnect()
    } catch (e) { /* ignore */ }
    this.currentGain?.disconnect()
    this.currentGain2?.disconnect()
  }
}
