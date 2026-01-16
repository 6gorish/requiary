/**
 * Sonification system configuration
 * All tunable parameters with approved defaults
 */

import type { SonificationConfig } from '@/lib/audio/types'

export const DEFAULT_SONIFICATION_CONFIG: SonificationConfig = {
  master: {
    gain: 0.7
  },

  reverb: {
    irPath: '/church-medium.ogg',
    wet: 0.3,    // Reverb return level
    dry: 0.7
  },

  ground: {
    bassNotes: [55, 82.5, 73.4],  // A1, E2, D2
    stateMinDuration: 120000,     // 2 minutes
    stateMaxDuration: 300000,     // 5 minutes
    crossfadeDuration: 12000,     // 12 seconds
    gain: 0.46                    // From mixer testing
  },

  field: {
    gain: 0.21,                   // From mixer testing
    filterCutoff: 800
  },

  cluster: {
    oscillatorCount: 4,
    baseDetuneCents: 5,
    gain: 0.44,                   // From mixer testing
    fadeInDuration: 8000,
    fadeOutDuration: 6000,
    pivotFadeInStart: 17,
    pivotGain: 0.60,              // From mixer testing
    resonancesGain: 1.0           // From mixer testing (100%)
  },

  connection: {
    articulationGain: 0.08,
    resonanceGain: 0.05,
    attackDuration: 2000,
    releaseDuration: 3000
  },

  shimmer: {
    probability: 0.25,
    gain: 0.40                    // From mixer testing
  },

  figura: {
    gain: 0.05                    // Sighs - from mixer testing
  },

  cantus: {
    gain: 0.50                    // From mixer testing
  },

  texture: {
    gain: 0.15                    // From mixer testing
  },

  pitch: {
    pentatonic: [0, 3, 5, 7, 10],
    baseOctave: 2
  }
}
