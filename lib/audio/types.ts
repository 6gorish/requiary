/**
 * Type definitions for Web Audio sonification system
 */

import type { GriefMessage } from '@/types/grief-messages'

export interface SonificationConfig {
  master: {
    gain: number                    // 0.0-1.0, default 0.7
  }

  reverb: {
    irPath: string                  // Path to impulse response
    wet: number                     // 0.0-1.0, default 0.3
    dry: number                     // 0.0-1.0, default 0.7
  }

  ground: {
    bassNotes: number[]             // [55, 82.5, 73.4] (A1, E2, D2 in Hz)
    stateMinDuration: number        // ms, default 120000 (2 min)
    stateMaxDuration: number        // ms, default 300000 (5 min)
    crossfadeDuration: number       // ms, default 12000 (12s)
    gain: number                    // default 0.46
  }

  field: {
    gain: number                    // default 0.21
    filterCutoff: number            // Hz, default 800
  }

  cluster: {
    oscillatorCount: number         // 3-4, default 4
    baseDetuneCents: number         // ±cents between oscillators, default 5
    gain: number                    // default 0.44
    fadeInDuration: number          // ms, default 8000
    fadeOutDuration: number         // ms, default 6000
    pivotFadeInStart: number        // seconds into cycle, default 17
    pivotGain?: number              // default 0.60
    resonancesGain?: number         // default 1.0
  }

  connection: {
    articulationGain: number        // Soft attack, default 0.08
    resonanceGain: number           // Sustained, default 0.05
    attackDuration: number          // ms, default 2000
    releaseDuration: number         // ms, default 3000
  }

  shimmer: {
    probability: number             // 0.0-1.0, default 0.25
    gain: number                    // default 0.40
  }

  figura: {
    gain: number                    // default 0.05 (very quiet sighs)
  }

  cantus: {
    gain: number                    // default 0.50
  }

  texture: {
    gain: number                    // default 0.15 (subliminal grit)
  }

  pitch: {
    pentatonic: number[]            // Scale degrees [0, 3, 5, 7, 10]
    baseOctave: number              // Octave above bass, default 2 (220Hz region)
  }
}

export interface ClusterAudioState {
  tonic: number                     // Current pitch in Hz
  tonicScaleDegree: number          // 0-7 within pentatonic
  oscillators: OscillatorNode[]
  gainNode: GainNode
  filterNode: BiquadFilterNode
  pivotOscillator: OscillatorNode | null
  pivotGain: GainNode | null
}

export interface ConnectionResonance {
  fromId: string
  toId: string
  oscillator: OscillatorNode
  gainNode: GainNode
  similarity: number
}

export type AudioState = 'uninitialized' | 'suspended' | 'running' | 'closed'

export interface MessageCluster {
  focus: GriefMessage
  next: GriefMessage | null
  related: Array<{
    message: GriefMessage
    similarity: number
  }>
}
