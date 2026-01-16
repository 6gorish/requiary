/**
 * Cluster Channel: Focus ensemble + pivot tone + connection resonances
 * Responds to cluster updates from MessageLogicService
 */

import { embeddingToPitch } from './pitch-utils'
import type { SonificationConfig, ClusterAudioState, ConnectionResonance, MessageCluster } from './types'

export class ClusterChannel {
  private context: AudioContext
  private config: SonificationConfig
  private outputGain: GainNode

  private state: ClusterAudioState | null = null
  private connectionResonances: Map<string, ConnectionResonance> = new Map()

  private cycleStartTime: number = 0
  private bassFrequencyGetter: (() => number) | null = null
  private pivotTimeout: NodeJS.Timeout | null = null
  private fadeOutTimeouts: Set<NodeJS.Timeout> = new Set()  // Track fadeout cleanup timeouts

  // Mixer state - separate gains for sub-channels
  private ensembleGainValue: number
  private pivotGainValue: number
  private resonancesGainValue: number
  private ensembleMuted: boolean = false
  private pivotMuted: boolean = false
  private resonancesMuted: boolean = false

  // Runtime-adjustable parameters
  private runtimeParams: {
    detuneCents: number
    fadeInDuration: number
    fadeOutDuration: number
    filterCutoff: number
  }

  // Sub-channel output gains (for independent control)
  private ensembleOutput: GainNode
  private pivotOutput: GainNode
  private resonancesOutput: GainNode

  constructor(context: AudioContext, config: SonificationConfig) {
    this.context = context
    this.config = config

    // Initialize runtime params from config
    this.runtimeParams = {
      detuneCents: config.cluster.baseDetuneCents,
      fadeInDuration: config.cluster.fadeInDuration,
      fadeOutDuration: config.cluster.fadeOutDuration,
      filterCutoff: 800
    }

    this.outputGain = context.createGain()
    this.outputGain.gain.value = 1.0  // Master stays at unity, sub-channels control levels

    // Initialize gain values from config
    this.ensembleGainValue = config.cluster.gain  // 0.44 from config
    this.pivotGainValue = config.cluster.pivotGain ?? 0.6
    this.resonancesGainValue = config.cluster.resonancesGain ?? 1.0

    // Create sub-channel outputs with config values
    this.ensembleOutput = context.createGain()
    this.ensembleOutput.gain.value = this.ensembleGainValue
    this.ensembleOutput.connect(this.outputGain)

    this.pivotOutput = context.createGain()
    this.pivotOutput.gain.value = this.pivotGainValue
    this.pivotOutput.connect(this.outputGain)

    this.resonancesOutput = context.createGain()
    this.resonancesOutput.gain.value = this.resonancesGainValue
    this.resonancesOutput.connect(this.outputGain)
  }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination)
  }

  setBassFrequencyGetter(getter: () => number): void {
    this.bassFrequencyGetter = getter
  }

  onClusterChange(cluster: MessageCluster): void {
    const bassHz = this.getBassFrequency()

    // Calculate new tonic from focus embedding
    const embedding = cluster.focus.semantic_data?.embedding
    const { scaleDegree, hz } = embeddingToPitch(
      embedding,
      this.config.pitch.pentatonic,
      bassHz,
      this.config.pitch.baseOctave
    )

    // If same pitch as previous, force timbral change
    const samePitch = !!(this.state && Math.abs(this.state.tonic - hz) < 1)

    // Fade out old cluster
    if (this.state) {
      this.fadeOutCluster(this.state)
    }

    // Create new cluster channel
    this.state = this.createClusterState(hz, scaleDegree, samePitch)
    this.fadeInCluster(this.state)

    // Clear old connection resonances
    this.connectionResonances.forEach(r => this.fadeOutResonance(r))
    this.connectionResonances.clear()

    // Reset cycle timer
    this.cycleStartTime = this.context.currentTime

    // Prepare pivot tone for next cluster
    if (cluster.next) {
      this.schedulePivot(cluster.next)
    }

    // Start connection resonances
    this.startConnectionTracking(cluster)
  }

  private createClusterState(
    tonic: number,
    scaleDegree: number,
    forceTimbralChange: boolean
  ): ClusterAudioState {
    const oscillators: OscillatorNode[] = []
    const gainNode = this.context.createGain()
    const filterNode = this.context.createBiquadFilter()

    gainNode.gain.value = 0 // Start silent, fade in
    filterNode.type = 'lowpass'
    filterNode.frequency.value = forceTimbralChange 
      ? this.runtimeParams.filterCutoff * 1.5 
      : this.runtimeParams.filterCutoff
    filterNode.Q.value = forceTimbralChange ? 2 : 1

    // Create oscillator ensemble
    const count = this.config.cluster.oscillatorCount
    const detune = this.runtimeParams.detuneCents

    for (let i = 0; i < count; i++) {
      const osc = this.context.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = tonic

      // Spread detune: -detune, -detune/3, +detune/3, +detune
      const spread = (i / (count - 1)) * 2 - 1 // -1 to 1
      osc.detune.value = spread * detune

      osc.connect(filterNode)
      osc.start()
      oscillators.push(osc)
    }

    // Route through ensemble sub-output
    filterNode.connect(gainNode)
    gainNode.connect(this.ensembleOutput)

    return {
      tonic,
      tonicScaleDegree: scaleDegree,
      oscillators,
      gainNode,
      filterNode,
      pivotOscillator: null,
      pivotGain: null
    }
  }

  private fadeInCluster(state: ClusterAudioState): void {
    const now = this.context.currentTime
    const fadeTime = this.runtimeParams.fadeInDuration / 1000
    
    // Use linear ramp for gradual, subliminal entrance
    // (exponential curves move too fast at the start)
    state.gainNode.gain.setValueAtTime(0, now)
    state.gainNode.gain.linearRampToValueAtTime(1, now + fadeTime)
  }

  private fadeOutCluster(state: ClusterAudioState): void {
    const now = this.context.currentTime
    const fadeTime = this.runtimeParams.fadeOutDuration / 1000

    // Use linear ramp for gradual fade out
    state.gainNode.gain.setValueAtTime(state.gainNode.gain.value, now)
    state.gainNode.gain.linearRampToValueAtTime(0, now + fadeTime)

    // Stop and disconnect oscillators after fade
    const cleanupTimeout = setTimeout(() => {
      this.fadeOutTimeouts.delete(cleanupTimeout)
      state.oscillators.forEach(o => {
        try { 
          o.stop()
          o.disconnect()
        } catch (e) { /* already stopped */ }
      })
      if (state.pivotOscillator) {
        try { 
          state.pivotOscillator.stop()
          state.pivotOscillator.disconnect()
        } catch (e) { /* already stopped */ }
      }
      if (state.pivotGain) {
        state.pivotGain.disconnect()
      }
      // Disconnect the gain and filter nodes
      state.gainNode.disconnect()
      state.filterNode.disconnect()
    }, this.runtimeParams.fadeOutDuration + 100)
    this.fadeOutTimeouts.add(cleanupTimeout)
  }

  private schedulePivot(nextMessage: { semantic_data?: { embedding: number[] } | null }): void {
    if (!this.state) return

    // Clear any existing pivot timeout
    if (this.pivotTimeout) {
      clearTimeout(this.pivotTimeout)
      this.pivotTimeout = null
    }

    const embedding = nextMessage.semantic_data?.embedding
    const bassHz = this.getBassFrequency()
    const { hz: pivotHz } = embeddingToPitch(
      embedding,
      this.config.pitch.pentatonic,
      bassHz,
      this.config.pitch.baseOctave
    )

    // Schedule pivot to fade in at configured time
    const pivotDelay = this.config.cluster.pivotFadeInStart * 1000

    this.pivotTimeout = setTimeout(() => {
      if (!this.state) return

      const osc = this.context.createOscillator()
      const gain = this.context.createGain()

      osc.type = 'sine'
      osc.frequency.value = pivotHz
      gain.gain.value = 0

      // Route through pivot sub-output
      osc.connect(gain)
      gain.connect(this.pivotOutput)
      osc.start()

      // Linear fade in over 4 seconds for gentle entrance
      const now = this.context.currentTime
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(this.pivotGainValue, now + 4)

      this.state.pivotOscillator = osc
      this.state.pivotGain = gain
    }, pivotDelay)
  }

  // Connection resonance methods
  addConnectionResonance(
    fromId: string,
    toId: string,
    similarity: number
  ): void {
    const key = `${fromId}-${toId}`
    if (this.connectionResonances.has(key) || !this.state) return

    // Map similarity to interval consonance
    const interval = this.similarityToInterval(similarity)
    const resonanceHz = this.state.tonic * interval

    const osc = this.context.createOscillator()
    const gain = this.context.createGain()

    osc.type = 'sine'
    osc.frequency.value = resonanceHz
    gain.gain.value = 0

    // Route through resonances sub-output
    osc.connect(gain)
    gain.connect(this.resonancesOutput)
    osc.start()

    const now = this.context.currentTime
    const attackTime = this.config.connection.attackDuration / 1000

    // Gentle linear fade in to articulation level, then settle to resonance level
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(
      this.config.connection.articulationGain,
      now + attackTime
    )
    // Then ease down to sustained resonance level
    gain.gain.linearRampToValueAtTime(
      this.config.connection.resonanceGain,
      now + attackTime + 1.0  // 1 second after peak
    )

    this.connectionResonances.set(key, {
      fromId,
      toId,
      oscillator: osc,
      gainNode: gain,
      similarity
    })
  }

  private fadeOutResonance(resonance: ConnectionResonance): void {
    const now = this.context.currentTime
    const releaseTime = this.config.connection.releaseDuration / 1000
    
    // Linear fade out
    resonance.gainNode.gain.setValueAtTime(resonance.gainNode.gain.value, now)
    resonance.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime)
    
    const cleanupTimeout = setTimeout(() => {
      this.fadeOutTimeouts.delete(cleanupTimeout)
      try { 
        resonance.oscillator.stop()
        resonance.oscillator.disconnect()
      } catch (e) { /* already stopped */ }
      resonance.gainNode.disconnect()
    }, this.config.connection.releaseDuration + 100)
    this.fadeOutTimeouts.add(cleanupTimeout)
  }

  private similarityToInterval(similarity: number): number {
    // High similarity = consonant intervals
    // Lower similarity = more tension
    if (similarity > 0.8) return 2.0      // Octave
    if (similarity > 0.65) return 1.5     // Fifth
    if (similarity > 0.5) return 1.25     // Major third
    if (similarity > 0.35) return 1.333   // Fourth
    if (similarity > 0.2) return 1.2      // Minor third
    return 1.125                           // Major second (tension)
  }

  private getBassFrequency(): number {
    return this.bassFrequencyGetter?.() ?? 55 // Fallback to A1
  }

  private startConnectionTracking(cluster: MessageCluster): void {
    // Trigger all connection resonances
    cluster.related.forEach(rel => {
      this.addConnectionResonance(
        cluster.focus.id,
        rel.message.id,
        rel.similarity
      )
    })
  }

  // ============================================================
  // MIXER API
  // ============================================================

  getEnsembleGain(): number {
    return this.ensembleGainValue
  }

  setEnsembleGain(gain: number): void {
    this.ensembleGainValue = gain
    if (!this.ensembleMuted) {
      this.ensembleOutput.gain.setTargetAtTime(gain, this.context.currentTime, 0.05)
    }
  }

  setEnsembleMuted(muted: boolean): void {
    this.ensembleMuted = muted
    this.ensembleOutput.gain.setTargetAtTime(
      muted ? 0 : this.ensembleGainValue,
      this.context.currentTime,
      0.05
    )
  }

  getPivotGain(): number {
    return this.pivotGainValue
  }

  setPivotGain(gain: number): void {
    this.pivotGainValue = gain
    if (!this.pivotMuted) {
      this.pivotOutput.gain.setTargetAtTime(gain, this.context.currentTime, 0.05)
    }
  }

  setPivotMuted(muted: boolean): void {
    this.pivotMuted = muted
    this.pivotOutput.gain.setTargetAtTime(
      muted ? 0 : this.pivotGainValue,
      this.context.currentTime,
      0.05
    )
  }

  hasPivotActive(): boolean {
    return this.state?.pivotOscillator !== null && this.state?.pivotOscillator !== undefined
  }

  getResonancesGain(): number {
    return this.resonancesGainValue
  }

  setResonancesGain(gain: number): void {
    this.resonancesGainValue = gain
    if (!this.resonancesMuted) {
      this.resonancesOutput.gain.setTargetAtTime(gain, this.context.currentTime, 0.05)
    }
  }

  setResonancesMuted(muted: boolean): void {
    this.resonancesMuted = muted
    this.resonancesOutput.gain.setTargetAtTime(
      muted ? 0 : this.resonancesGainValue,
      this.context.currentTime,
      0.05
    )
  }

  getActiveResonanceCount(): number {
    return this.connectionResonances.size
  }

  /**
   * Set runtime parameters (for real-time tuning)
   * Updates current oscillators immediately where applicable
   */
  setParams(params: {
    detuneCents?: number
    fadeInDuration?: number
    fadeOutDuration?: number
    filterCutoff?: number
  }): void {
    // Update stored params
    if (params.detuneCents !== undefined) {
      this.runtimeParams.detuneCents = params.detuneCents
      // Apply to current oscillators immediately
      if (this.state) {
        const count = this.state.oscillators.length
        this.state.oscillators.forEach((osc, i) => {
          const spread = (i / (count - 1)) * 2 - 1
          osc.detune.setTargetAtTime(
            spread * params.detuneCents!,
            this.context.currentTime,
            0.5  // Smooth transition over 0.5s
          )
        })
      }
    }
    
    if (params.fadeInDuration !== undefined) {
      this.runtimeParams.fadeInDuration = params.fadeInDuration
    }
    
    if (params.fadeOutDuration !== undefined) {
      this.runtimeParams.fadeOutDuration = params.fadeOutDuration
    }
    
    if (params.filterCutoff !== undefined) {
      this.runtimeParams.filterCutoff = params.filterCutoff
      // Apply to current filter immediately
      if (this.state?.filterNode) {
        this.state.filterNode.frequency.setTargetAtTime(
          params.filterCutoff,
          this.context.currentTime,
          0.3  // Smooth transition
        )
      }
    }
  }

  /**
   * Get current runtime parameters
   */
  getParams(): typeof this.runtimeParams {
    return { ...this.runtimeParams }
  }

  stop(): void {
    // Clear pivot timeout
    if (this.pivotTimeout) {
      clearTimeout(this.pivotTimeout)
      this.pivotTimeout = null
    }

    // Clear all fade out timeouts
    for (const timeout of this.fadeOutTimeouts) {
      clearTimeout(timeout)
    }
    this.fadeOutTimeouts.clear()

    // Clean up current cluster state
    if (this.state) {
      this.state.oscillators.forEach(o => {
        try {
          o.stop()
          o.disconnect()
        } catch (e) { /* ignore */ }
      })
      if (this.state.pivotOscillator) {
        try {
          this.state.pivotOscillator.stop()
          this.state.pivotOscillator.disconnect()
        } catch (e) { /* ignore */ }
      }
      if (this.state.pivotGain) {
        this.state.pivotGain.disconnect()
      }
      this.state.gainNode.disconnect()
      this.state.filterNode.disconnect()
      this.state = null
    }

    // Clean up all connection resonances
    this.connectionResonances.forEach(r => {
      try {
        r.oscillator.stop()
        r.oscillator.disconnect()
      } catch (e) { /* ignore */ }
      r.gainNode.disconnect()
    })
    this.connectionResonances.clear()
  }
}
