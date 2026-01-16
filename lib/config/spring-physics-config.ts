/**
 * Spring physics configuration
 * Stage 2: Core Spring Physics
 * All values approved by James
 */

export interface SpringPhysicsConfig {
  // === GLOBAL ENABLE/DISABLE ===
  enabled: boolean

  // === BASE PHYSICS VALUES ===
  base: {
    springConstant: number
    damping: number
    mass: number
  }

  // === LENGTH SCALING ===
  lengthScaling: {
    springExponent: number
    massExponent: number
    deviationFactor: number
    flowInfluenceExponent: number
  }

  // === PARAMETRIC POSITION ===
  parametric: {
    enabled: boolean
    minT: number
    maxT: number
    longitudinalScale: number
    bounceRestitution: number
  }

  // === CONTROL POINT COUPLING ===
  coupling: {
    enabled: boolean
    strength: number
    delay: number
  }

  // === FLOW FIELD INTEGRATION (for future use) ===
  flowField: {
    enabled: boolean
    sampleRate: number
    influenceStrength: number
    smoothingFrames: number
  }

  // === EVENT PERTURBATIONS (for future use) ===
  perturbations: {
    enabled: boolean

    messageAppearance: {
      strength: number
      radius: number
      falloffExponent: number
    }

    focusTransition: {
      strength: number
      radius: number
      directional: boolean
    }

    relatedCascade: {
      strength: number
      radius: number
      sequential: boolean
    }
  }

  // === PERFORMANCE ===
  performance: {
    updateFrequency: number
    distantSimplification: boolean
    simplificationDistance: number
  }

  // === DEVICE-SPECIFIC OVERRIDES ===
  deviceOverrides: {
    mobile: Partial<SpringPhysicsConfig>
    tablet: Partial<SpringPhysicsConfig>
  }
}

export const DEFAULT_SPRING_PHYSICS_CONFIG: SpringPhysicsConfig = {
  enabled: true,

  base: {
    springConstant: 0.8,    // REDUCED from 1.2 - softer springs, slower response
    damping: 0.45,          // INCREASED from 0.25 - more damping, less wiggling
    mass: 1.0
  },

  lengthScaling: {
    springExponent: 1.5,
    massExponent: 0.7,
    deviationFactor: 0.15,
    flowInfluenceExponent: 0.5
  },

  parametric: {
    enabled: true,
    minT: 0.15,
    maxT: 0.85,
    longitudinalScale: 0.005,  // DRAMATICALLY REDUCED from 0.05 (was 0.35) - LOCKS control points, prevents visible sliding
    // Near-zero parametric forces ensure control points stay locked at t=0.33 and t=0.67
    // All visible motion is perpendicular billowing around catenary curves
    // This prevents "joints" and creates smooth, naturalistic gossamer effect
    bounceRestitution: 0.3
  },

  coupling: {
    enabled: true,
    strength: 0.2,
    delay: 2
  },

  flowField: {
    enabled: false,  // Will enable in Stage 3
    sampleRate: 45,
    influenceStrength: 12.0,  // DRAMATICALLY INCREASED from 4.0 - needs to compete with global forces (6.5 total)
    // Flow field should be DOMINANT force, not subtle accent
    // With 12.0 strength, flow patterns clearly visible in line motion
    smoothingFrames: 2  // REDUCED from 3 - more responsive to rapid changes in noise field
  },

  perturbations: {
    enabled: false,  // Will enable in Stage 4

    messageAppearance: {
      strength: 12.0,
      radius: 200,
      falloffExponent: 2.0
    },

    focusTransition: {
      strength: 25.0,
      radius: 300,
      directional: true
    },

    relatedCascade: {
      strength: 5.0,
      radius: 100,
      sequential: true
    }
  },

  performance: {
    updateFrequency: 60,
    distantSimplification: false,  // Will enable in Stage 7
    simplificationDistance: 1000
  },

  deviceOverrides: {
    mobile: {
      base: { springConstant: 1.0, damping: 0.3, mass: 1.0 },
      performance: { updateFrequency: 30, distantSimplification: false, simplificationDistance: 1000 }
    },
    tablet: {
      performance: { updateFrequency: 45, distantSimplification: false, simplificationDistance: 1000 }
    }
  }
}
