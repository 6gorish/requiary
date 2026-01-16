/**
 * Type definitions for spring physics system
 * Stage 2: Core Spring Physics
 */

export interface Vector2D {
  x: number
  y: number
}

export interface ControlPoint {
  // === PARAMETRIC POSITION (slides along line) ===
  t: number                    // Current position [0.0, 1.0]
  tHome: number                // Resting position (0.33 or 0.67)
  tVelocity: number            // Velocity of sliding
  tMass: number                // Inertia for longitudinal motion

  // === PERPENDICULAR DEVIATION (billows sideways) ===
  perpOffset: number           // Distance from straight line
  perpHomeOffset: number       // Natural rest offset (slack/curvature) - LONGER LINES = MORE SLACK
  perpVelocity: number         // Velocity of lateral motion
  perpMass: number             // Inertia for lateral motion

  // === PHYSICS PROPERTIES (length-scaled) ===
  springConstant: number       // k = baseK / length^exponent
  damping: number              // Energy dissipation
  maxPerpDeviation: number     // length * deviationFactor
  flowFieldInfluence: number   // Sensitivity to external forces (for future use)

  // === FORCE ACCUMULATORS ===
  parallelForce: number        // Forces along line direction
  perpendicularForce: number   // Forces lateral to line

  // === COMPUTED RENDERING POSITION ===
  x: number                    // Final screen position
  y: number                    // Final screen position

  // === FORCE SMOOTHING (Stage 3) ===
  forceHistory: {
    parallel: number[]
    perpendicular: number[]
  }
}

export interface ConnectionLinePhysics {
  controlPoint1: ControlPoint
  controlPoint2: ControlPoint

  // === LINE PROPERTIES ===
  length: number               // Euclidean distance between particles
  direction: Vector2D          // Normalized direction vector
  perpDirection: Vector2D      // 90° rotation for lateral forces

  // === COUPLING ===
  couplingStrength: number     // How much cp1 influences cp2 [0, 1]

  // === FLOW FIELD SAMPLING (for future use) ===
  flowFieldSamplePoints: Vector2D[]
  lastFlowFieldUpdate: number
}
