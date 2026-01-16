/**
 * Apply separation forces between control points
 * Prevents them from bunching up and creating sharp kinks
 */
export function applyControlPointSeparation(
  linePhysics: ConnectionLinePhysics,
  config: SpringPhysicsConfig
): void {
  const cp1 = linePhysics.controlPoint1
  const cp2 = linePhysics.controlPoint2
  
  // Minimum separation: control points should stay at least 20% of line length apart
  const minSeparation = 0.2
  const currentSeparation = Math.abs(cp2.t - cp1.t)
  
  if (currentSeparation < minSeparation) {
    // They're too close - apply repulsive force
    const overlap = minSeparation - currentSeparation
    const repulsionStrength = overlap * cp1.springConstant * 3.0  // Strong repulsion
    
    // Push them apart along parametric axis
    // If cp2 > cp1, push cp2 right and cp1 left
    // If cp1 > cp2, push cp1 right and cp2 left
    if (cp2.t > cp1.t) {
      cp1.parallelForce -= repulsionStrength  // Push cp1 toward 0 (left)
      cp2.parallelForce += repulsionStrength  // Push cp2 toward 1 (right)
    } else {
      cp1.parallelForce += repulsionStrength  // Push cp1 toward 1 (right)
      cp2.parallelForce -= repulsionStrength  // Push cp2 toward 0 (left)
    }
  }
}

/**
 * Core physics simulation loop
 * Stage 2: Core Spring Physics
 */

import { ControlPoint, ConnectionLinePhysics } from '@/lib/types/spring-physics'
import { SpringPhysicsConfig } from '@/lib/config/spring-physics-config'

/**
 * Update control point physics for one timestep
 */
export function updateControlPointPhysics(
  cp: ControlPoint,
  linePhysics: ConnectionLinePhysics,
  config: SpringPhysicsConfig,
  dt: number
): void {
  // === LONGITUDINAL (PARAMETRIC) PHYSICS ===

  // NON-LINEAR SPRING FORCE: Resistance increases exponentially with distance from home
  // This prevents control points from wandering too far and creating sharp bends
  const distanceFromHome = cp.t - cp.tHome
  const absDistance = Math.abs(distanceFromHome)
  
  // Exponential resistance: small movements = gentle spring, large movements = strong spring
  // exp(4 * distance) means: at 25% away from home, force is ~2.7x stronger
  const nonlinearFactor = Math.exp(absDistance * 4.0)
  const tSpringForce = -cp.springConstant * distanceFromHome * nonlinearFactor

  // Damping force: resist velocity
  const tDampingForce = -cp.damping * cp.tVelocity

  // Total longitudinal force
  // Note: parallelForce will be zero for now (no external forces yet)
  const tTotalForce = (
    cp.parallelForce * config.parametric.longitudinalScale +
    tSpringForce +
    tDampingForce
  )

  // Update parametric position
  const tAccel = tTotalForce / cp.tMass
  cp.tVelocity += tAccel * dt
  cp.t += cp.tVelocity * dt

  // Constrain t with bounce
  if (cp.t < config.parametric.minT) {
    cp.t = config.parametric.minT
    cp.tVelocity *= -config.parametric.bounceRestitution
  } else if (cp.t > config.parametric.maxT) {
    cp.t = config.parametric.maxT
    cp.tVelocity *= -config.parametric.bounceRestitution
  }

  // === PERPENDICULAR (LATERAL) PHYSICS ===

  // Spring force: pull perpOffset back to HOME OFFSET (curved rest position)
  // NOT toward 0 - lines have natural slack/looseness
  const perpSpringForce = -cp.springConstant * (cp.perpOffset - cp.perpHomeOffset)

  // Damping force
  const perpDampingForce = -cp.damping * cp.perpVelocity

  // Total perpendicular force
  // Note: perpendicularForce will be zero for now (no external forces yet)
  const perpTotalForce = (
    cp.perpendicularForce +
    perpSpringForce +
    perpDampingForce
  )

  // Update perpendicular deviation
  const perpAccel = perpTotalForce / cp.perpMass
  cp.perpVelocity += perpAccel * dt
  cp.perpOffset += cp.perpVelocity * dt

  // Constrain perpendicular with bounce
  if (Math.abs(cp.perpOffset) > cp.maxPerpDeviation) {
    cp.perpOffset = Math.sign(cp.perpOffset) * cp.maxPerpDeviation
    cp.perpVelocity *= -config.parametric.bounceRestitution
  }

  // Reset force accumulators for next frame
  cp.parallelForce = 0
  cp.perpendicularForce = 0
}
