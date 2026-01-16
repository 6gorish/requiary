/**
 * Cantus Layer: Rare melodic vocal interventions
 * 
 * Uses Lidell vocal samples to create slow, counterpoint-like phrases
 * that emerge every 5-15 minutes. Heavy dedicated reverb pushes the
 * sound deep into the background — like a distant choir.
 * 
 * lidell-104 serves as tonic, other samples as scale degrees.
 * Phrases are 3-6 notes with legato overlap between notes.
 */

import type { SonificationConfig } from './types'
import { sampleCache } from './sample-cache'

// Vocal samples mapped to scale degrees
// Tonic (104) has higher probability at phrase start/end
const CANTUS_SAMPLES = [
  { file: 'lidell-104.mp3', degree: 'I', isTonic: true },
  { file: 'lidell-106.mp3', degree: 'II', isTonic: false },
  { file: 'lidell-107.mp3', degree: 'III', isTonic: false },
  { file: 'lidell-111.mp3', degree: 'IV', isTonic: false },
  { file: 'lidell-112.mp3', degree: 'V', isTonic: false },
  { file: 'lidell-114.mp3', degree: 'VI', isTonic: false },
  { file: 'lidell-116.mp3', degree: 'VII', isTonic: false },
  { file: 'lidell-119.mp3', degree: 'VIII', isTonic: false },
]

// Transition probability matrix (simplified)
// Higher values = more likely to transition to that degree
// Favors stepwise motion and resolution to tonic
const TRANSITION_WEIGHTS: Record<string, Record<string, number>> = {
  'I':    { 'I': 1, 'II': 3, 'III': 2, 'IV': 2, 'V': 3, 'VI': 1, 'VII': 1, 'VIII': 1 },
  'II':   { 'I': 3, 'II': 1, 'III': 3, 'IV': 2, 'V': 2, 'VI': 1, 'VII': 1, 'VIII': 1 },
  'III':  { 'I': 2, 'II': 3, 'III': 1, 'IV': 3, 'V': 2, 'VI': 2, 'VII': 1, 'VIII': 1 },
  'IV':   { 'I': 2, 'II': 2, 'III': 3, 'IV': 1, 'V': 3, 'VI': 2, 'VII': 1, 'VIII': 1 },
  'V':    { 'I': 4, 'II': 2, 'III': 2, 'IV': 3, 'V': 1, 'VI': 2, 'VII': 2, 'VIII': 1 },
  'VI':   { 'I': 2, 'II': 2, 'III': 2, 'IV': 2, 'V': 3, 'VI': 1, 'VII': 3, 'VIII': 1 },
  'VII':  { 'I': 4, 'II': 1, 'III': 2, 'IV': 1, 'V': 2, 'VI': 3, 'VII': 1, 'VIII': 2 },
  'VIII': { 'I': 3, 'II': 1, 'III': 1, 'IV': 1, 'V': 2, 'VI': 2, 'VII': 3, 'VIII': 1 },
}

interface SampleInfo {
  file: string
  degree: string
  isTonic: boolean
  buffer: AudioBuffer | null
  duration: number
}

interface ActiveVoice {
  source: AudioBufferSourceNode
  gain: GainNode
  sample: SampleInfo
  startTime: number
}

export class CantusLayer {
  private context: AudioContext
  private outputGain: GainNode
  
  // Dedicated reverb for lush sound
  private convolver: ConvolverNode | null = null
  private reverbGain: GainNode
  private dryGain: GainNode
  
  // Sample management
  private samples: SampleInfo[] = []
  private loadedCount: number = 0
  private activeVoices: Map<string, ActiveVoice> = new Map()
  private voiceCounter: number = 0
  
  // Phrase state
  private isPlayingPhrase: boolean = false
  private currentDegree: string = 'I'
  private notesInPhrase: number = 0
  private phraseTimeout: NodeJS.Timeout | null = null
  private nextPhraseTimeout: NodeJS.Timeout | null = null
  
  // Timing parameters (in ms)
  private minPhraseInterval: number = 300000   // 5 minutes default
  private maxPhraseInterval: number = 900000   // 15 minutes default
  private minNotesPerPhrase: number = 3
  private maxNotesPerPhrase: number = 6
  private noteOverlapRatio: number = 0.3       // 30% overlap between notes
  private noteFadeInDuration: number = 2000    // 2s fade in
  private noteFadeOutDuration: number = 4000   // 4s fade out (long tail)
  
  // Mixer state
  private baseGain: number  // Set from config
  private reverbMix: number = 0.85    // 85% wet, very reverberant
  private isMuted: boolean = false

  constructor(context: AudioContext, config: SonificationConfig['cantus']) {
    this.context = context
    this.baseGain = config.gain  // Use config value

    // Output gain (master level for this layer)
    this.outputGain = context.createGain()
    this.outputGain.gain.value = this.baseGain

    // Dry path (minimal)
    this.dryGain = context.createGain()
    this.dryGain.gain.value = 1 - this.reverbMix
    this.dryGain.connect(this.outputGain)

    // Reverb path (dominant)
    this.reverbGain = context.createGain()
    this.reverbGain.gain.value = this.reverbMix
    this.reverbGain.connect(this.outputGain)

    // Initialize samples array
    this.samples = CANTUS_SAMPLES.map(s => ({
      ...s,
      buffer: null,
      duration: 0
    }))

    // Load samples and reverb
    this.initialize()
  }

  private async initialize(): Promise<void> {
    await Promise.all([
      this.loadSamples(),
      this.loadReverb()
    ])

    // Start the phrase cycle
    if (this.loadedCount > 0) {
      this.scheduleNextPhrase()
    }
  }

  private async loadSamples(): Promise<void> {
    console.log('[CantusLayer] Loading vocal samples via cache...')

    const loadPromises = this.samples.map(async (sample) => {
      const buffer = await sampleCache.load(sample.file)
      if (buffer) {
        sample.buffer = buffer
        sample.duration = buffer.duration
        this.loadedCount++
        console.log(`[CantusLayer] Loaded: ${sample.file} (${sample.duration.toFixed(2)}s) → ${sample.degree}`)
      }
    })

    await Promise.allSettled(loadPromises)
    console.log(`[CantusLayer] Loaded ${this.loadedCount}/${this.samples.length} samples`)
  }

  private async loadReverb(): Promise<void> {
    try {
      // Use the same IR but we'll configure it for maximum lushness
      const response = await fetch('/church-medium.ogg')
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer)

      this.convolver = this.context.createConvolver()
      this.convolver.buffer = audioBuffer
      this.convolver.connect(this.reverbGain)

      console.log('[CantusLayer] Loaded dedicated reverb')
    } catch (error) {
      console.warn('[CantusLayer] Failed to load reverb IR:', error)
      // Fallback: connect dry gain directly to output (no reverb)
      this.dryGain.gain.value = 1
      this.reverbGain.gain.value = 0
    }
  }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination)
  }

  // ============================================================
  // PHRASE GENERATION
  // ============================================================

  private scheduleNextPhrase(): void {
    const delay = this.minPhraseInterval + 
      Math.random() * (this.maxPhraseInterval - this.minPhraseInterval)

    console.log(`[CantusLayer] Next phrase in ${(delay / 1000 / 60).toFixed(1)} minutes`)

    this.nextPhraseTimeout = setTimeout(() => {
      this.startPhrase()
    }, delay)
  }

  private startPhrase(): void {
    if (this.isPlayingPhrase || this.isMuted) {
      this.scheduleNextPhrase()
      return
    }

    this.isPlayingPhrase = true
    this.notesInPhrase = 0
    this.currentDegree = 'I'  // Always start on tonic

    const targetNotes = this.minNotesPerPhrase + 
      Math.floor(Math.random() * (this.maxNotesPerPhrase - this.minNotesPerPhrase + 1))

    console.log(`[CantusLayer] Starting phrase with ${targetNotes} notes`)

    this.playNextNote(targetNotes)
  }

  private playNextNote(targetNotes: number): void {
    // Select next note based on current position in phrase
    const isFirstNote = this.notesInPhrase === 0
    const isLastNote = this.notesInPhrase >= targetNotes - 1

    let nextDegree: string

    if (isFirstNote) {
      // Always start on tonic
      nextDegree = 'I'
    } else if (isLastNote) {
      // Strong tendency to resolve to tonic
      nextDegree = Math.random() < 0.7 ? 'I' : this.selectNextDegree()
    } else {
      nextDegree = this.selectNextDegree()
    }

    const sample = this.samples.find(s => s.degree === nextDegree && s.buffer)
    if (!sample || !sample.buffer) {
      console.warn(`[CantusLayer] No sample for degree ${nextDegree}`)
      this.endPhrase()
      return
    }

    this.currentDegree = nextDegree
    this.notesInPhrase++

    // Play the note
    const voice = this.playVoice(sample)

    // Calculate when to start the next note (with overlap)
    const noteDuration = sample.duration * 1000  // ms
    const overlapTime = noteDuration * this.noteOverlapRatio
    const nextNoteDelay = noteDuration - overlapTime

    if (this.notesInPhrase < targetNotes) {
      this.phraseTimeout = setTimeout(() => {
        this.playNextNote(targetNotes)
      }, nextNoteDelay)
    } else {
      // Phrase complete - wait for last note to finish, then schedule next phrase
      this.phraseTimeout = setTimeout(() => {
        this.endPhrase()
      }, noteDuration + this.noteFadeOutDuration)
    }
  }

  private selectNextDegree(): string {
    const weights = TRANSITION_WEIGHTS[this.currentDegree]
    if (!weights) return 'I'

    // Build weighted random selection
    const entries = Object.entries(weights)
    const totalWeight = entries.reduce((sum, [_, w]) => sum + w, 0)
    let random = Math.random() * totalWeight

    for (const [degree, weight] of entries) {
      random -= weight
      if (random <= 0) {
        return degree
      }
    }

    return 'I'  // Fallback
  }

  private playVoice(sample: SampleInfo): ActiveVoice {
    const source = this.context.createBufferSource()
    source.buffer = sample.buffer!
    source.loop = false

    const gain = this.context.createGain()
    gain.gain.value = 0  // Start silent for fade in

    source.connect(gain)
    
    // Connect to both dry and reverb paths
    gain.connect(this.dryGain)
    if (this.convolver) {
      gain.connect(this.convolver)
    }

    const id = `cantus-${this.voiceCounter++}`
    const voice: ActiveVoice = {
      source,
      gain,
      sample,
      startTime: this.context.currentTime
    }

    this.activeVoices.set(id, voice)

    // Fade in
    const now = this.context.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + this.noteFadeInDuration / 1000)

    // Schedule fade out
    const fadeOutStart = now + sample.duration - (this.noteFadeOutDuration / 1000)
    gain.gain.setValueAtTime(1, fadeOutStart)
    gain.gain.linearRampToValueAtTime(0, fadeOutStart + this.noteFadeOutDuration / 1000)

    // Cleanup when done
    source.onended = () => {
      this.activeVoices.delete(id)
      try {
        source.disconnect()
        gain.disconnect()
      } catch (e) { /* ignore */ }
    }

    source.start()
    console.log(`[CantusLayer] Playing ${sample.degree} (${sample.file})`)

    return voice
  }

  private endPhrase(): void {
    this.isPlayingPhrase = false
    console.log(`[CantusLayer] Phrase complete (${this.notesInPhrase} notes)`)
    this.scheduleNextPhrase()
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  isPlaying(): boolean {
    return this.activeVoices.size > 0
  }

  isPhraseActive(): boolean {
    return this.isPlayingPhrase
  }

  getCurrentDegree(): string {
    return this.isPlayingPhrase ? this.currentDegree : '—'
  }

  getActiveVoiceCount(): number {
    return this.activeVoices.size
  }

  /**
   * Manually trigger a phrase (for testing)
   */
  triggerPhrase(): void {
    if (this.isPlayingPhrase) return
    
    // Clear any pending scheduled phrase
    if (this.nextPhraseTimeout) {
      clearTimeout(this.nextPhraseTimeout)
      this.nextPhraseTimeout = null
    }
    
    this.startPhrase()
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
      this.outputGain.gain.setTargetAtTime(gain, this.context.currentTime, 0.1)
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted
    this.outputGain.gain.setTargetAtTime(
      muted ? 0 : this.baseGain,
      this.context.currentTime,
      0.1
    )
  }

  /**
   * Set phrase interval range (in minutes, for param knob)
   */
  setPhraseInterval(minMinutes: number, maxMinutes: number): void {
    this.minPhraseInterval = minMinutes * 60 * 1000
    this.maxPhraseInterval = maxMinutes * 60 * 1000
    console.log(`[CantusLayer] Phrase interval: ${minMinutes}-${maxMinutes} minutes`)
  }

  /**
   * Get current phrase interval (min, in minutes)
   */
  getPhraseIntervalMin(): number {
    return this.minPhraseInterval / 60 / 1000
  }

  /**
   * Set reverb mix (0 = dry, 1 = full wet)
   */
  setReverbMix(mix: number): void {
    this.reverbMix = Math.max(0, Math.min(1, mix))
    this.dryGain.gain.setTargetAtTime(1 - this.reverbMix, this.context.currentTime, 0.1)
    this.reverbGain.gain.setTargetAtTime(this.reverbMix, this.context.currentTime, 0.1)
  }

  getReverbMix(): number {
    return this.reverbMix
  }

  stop(): void {
    // Clear timeouts
    if (this.phraseTimeout) {
      clearTimeout(this.phraseTimeout)
      this.phraseTimeout = null
    }
    if (this.nextPhraseTimeout) {
      clearTimeout(this.nextPhraseTimeout)
      this.nextPhraseTimeout = null
    }

    // Stop all voices
    for (const voice of this.activeVoices.values()) {
      try {
        voice.source.stop()
        voice.source.disconnect()
        voice.gain.disconnect()
      } catch (e) { /* ignore */ }
    }
    this.activeVoices.clear()

    // Disconnect reverb
    if (this.convolver) {
      try {
        this.convolver.disconnect()
      } catch (e) { /* ignore */ }
    }

    // Release cache references
    for (const sample of this.samples) {
      if (sample.buffer) {
        sampleCache.release(sample.file)
      }
    }

    this.isPlayingPhrase = false
  }
}
