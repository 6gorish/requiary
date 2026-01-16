/**
 * Physics utility functions for spring system
 * Stage 2: Core Spring Physics
 */

import { Vector2D, ControlPoint, ConnectionLinePhysics } from '@/lib/types/spring-physics'
import { SpringPhysicsConfig } from '@/lib/config/spring-physics-config'

/**
 * Initialize physics properties for a connection line
 */
export function initializeConnectionPhysics(
  fromParticle: { x: number; y: number },
  toParticle: { x: number; y: number },
  config: SpringPhysicsConfig
): ConnectionLinePhysics {
  // Calculate line geometry
  const dx = toParticle.x - fromParticle.x
  const dy = toParticle.y - fromParticle.y
  const length = Math.sqrt(dx * dx + dy * dy)

  // Normalized direction vector
  const direction: Vector2D = {
    x: dx / length,
    y: dy / length
  }

  // Perpendicular direction (90° rotation)
  const perpDirection: Vector2D = {
    x: -direction.y,
    y: direction.x
  }

  // Calculate length-scaled properties
  const referenceLength = 300  // Baseline for normalization
  const normalizedLength = length / referenceLength

  const springConstant = config.base.springConstant /
    Math.pow(normalizedLength, config.lengthScaling.springExponent)

  const mass = config.base.mass *
    Math.pow(normalizedLength, config.lengthScaling.massExponent)

  const maxPerpDeviation = length * config.lengthScaling.deviationFactor

  const flowFieldInfluence =
    Math.pow(normalizedLength, config.lengthScaling.flowInfluenceExponent)

  // === SLACK/LOOSENESS: Lines have natural curvature ===
  // Longer lines are "looser" - more natural slack/curvature
  // DRAMATICALLY INCREASED: Short lines: 15-20% slack, Long lines: 30-50% slack
  const slackFactor = 0.15 + (normalizedLength * 0.35)  // Much looser, more organic
  const baseSlack = maxPerpDeviation * slackFactor

  // Slack values tuned for natural catenary curves
  // Short lines: 15-20% slack, Long lines: 30-50% slack

  // Create control points
  const createControlPoint = (tHome: number): ControlPoint => {
    // === NATURAL SLACK/CURVATURE ===
    // Each line has inherent looseness - control points rest at curved position, not straight
    // Random direction (+ or -) and magnitude variation for organic feel
    const slackDirection = Math.random() < 0.5 ? -1 : 1  // Random side
    const slackVariation = 0.8 + Math.random() * 0.4     // 80-120% of base slack
    const perpHomeOffset = baseSlack * slackDirection * slackVariation

    // === GENTLE INITIALIZATION ===
    // Start control points EXACTLY at their home positions
    // Perpendicular velocity: small but present (creates lateral billowing)
    // Parametric velocity: near-zero (prevents longitudinal sliding)
    const initialPerpOffset = perpHomeOffset  // Start exactly at home (no perturbation)
    const initialPerpVelocity = (Math.random() - 0.5) * 1.0  // ±0.5 - enough for breathing motion
    
    const initialTOffset = 0  // Start exactly at tHome
    const initialTVelocity = (Math.random() - 0.5) * 0.1  // ±0.05 - TINY parametric velocity (locked)

    return {
      t: tHome + initialTOffset,  // Start at exact home position
      tHome,
      tVelocity: initialTVelocity,  // Near-zero initial velocity
      tMass: mass,

      perpOffset: initialPerpOffset,
      perpHomeOffset: perpHomeOffset,  // Natural curved rest position
      perpVelocity: initialPerpVelocity,
      perpMass: mass,

      springConstant,
      damping: config.base.damping,
      maxPerpDeviation,
      flowFieldInfluence,

      parallelForce: 0,
      perpendicularForce: 0,

      x: 0,  // Will be calculated
      y: 0,

      // Initialize force history for smoothing
      forceHistory: {
        parallel: [],
        perpendicular: []
      }
    }
  }

  return {
    controlPoint1: createControlPoint(0.33),
    controlPoint2: createControlPoint(0.67),
    length,
    direction,
    perpDirection,
    couplingStrength: config.coupling.strength,
    flowFieldSamplePoints: [],
    lastFlowFieldUpdate: 0
  }
}

/**
 * Update line geometry (call if particles move, though they shouldn't)
 */
export function updateLineGeometry(
  physics: ConnectionLinePhysics,
  fromParticle: { x: number; y: number },
  toParticle: { x: number; y: number }
): void {
  const dx = toParticle.x - fromParticle.x
  const dy = toParticle.y - fromParticle.y
  const length = Math.sqrt(dx * dx + dy * dy)

  physics.length = length
  physics.direction = { x: dx / length, y: dy / length }
  physics.perpDirection = { x: -physics.direction.y, y: physics.direction.x }
}

/**
 * Calculate final rendering position for a control point
 */
export function calculateControlPointPosition(
  cp: ControlPoint,
  fromParticle: { x: number; y: number },
  linePhysics: ConnectionLinePhysics
): void {
  // Point along straight line at parameter t
  const linePointX = fromParticle.x + linePhysics.direction.x * linePhysics.length * cp.t
  const linePointY = fromParticle.y + linePhysics.direction.y * linePhysics.length * cp.t

  // Add perpendicular offset
  cp.x = linePointX + linePhysics.perpDirection.x * cp.perpOffset
  cp.y = linePointY + linePhysics.perpDirection.y * cp.perpOffset
}

/**
 * Apply coupling forces between control points
 */
export function applyCoupling(
  linePhysics: ConnectionLinePhysics,
  config: SpringPhysicsConfig
): void {
  if (!config.coupling.enabled || config.coupling.strength === 0) return

  const cp1 = linePhysics.controlPoint1
  const cp2 = linePhysics.controlPoint2
  const strength = config.coupling.strength

  // Couple parametric positions
  const avgTVelocity = (cp1.tVelocity + cp2.tVelocity) / 2
  const tCouplingForce1 = (avgTVelocity - cp1.tVelocity) * strength
  const tCouplingForce2 = (avgTVelocity - cp2.tVelocity) * strength

  cp1.parallelForce += tCouplingForce1 * cp1.tMass
  cp2.parallelForce += tCouplingForce2 * cp2.tMass

  // Couple perpendicular offsets
  const avgPerpVelocity = (cp1.perpVelocity + cp2.perpVelocity) / 2
  const perpCouplingForce1 = (avgPerpVelocity - cp1.perpVelocity) * strength
  const perpCouplingForce2 = (avgPerpVelocity - cp2.perpVelocity) * strength

  cp1.perpendicularForce += perpCouplingForce1 * cp1.perpMass
  cp2.perpendicularForce += perpCouplingForce2 * cp2.perpMass
}
