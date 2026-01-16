/**
 * Flow field sampling for spring physics
 * Stage 3: Extract velocity data from shader output
 *
 * CRITICAL: Uses gradient-based sampling to decouple physics from visual tuning
 * Brightness/opacity adjustments don't affect physics behavior
 */

import { Vector2D, ControlPoint, ConnectionLinePhysics } from '@/lib/types/spring-physics'
import { SpringPhysicsConfig } from '@/lib/config/spring-physics-config'

/**
 * Sample flow field velocity using GRADIENTS (robust method)
 * Measures rate of change in brightness, not absolute values
 * Immune to shader brightness/opacity tuning
 */
export function sampleFlowField(
  shaderGraphics: any, // p5.Graphics with shader output
  x: number,
  y: number
): Vector2D {
  const offset = 3  // Pixels to sample for gradient calculation

  // Clamp sampling positions to stay in bounds
  const width = shaderGraphics.width
  const height = shaderGraphics.height
  const clampX = (val: number) => Math.max(0, Math.min(width - 1, val))
  const clampY = (val: number) => Math.max(0, Math.min(height - 1, val))

  // Sample 5 points: center + cardinal directions
  const center = shaderGraphics.get(clampX(x), clampY(y))
  const right = shaderGraphics.get(clampX(x + offset), clampY(y))
  const left = shaderGraphics.get(clampX(x - offset), clampY(y))
  const down = shaderGraphics.get(clampX(x), clampY(y + offset))
  const up = shaderGraphics.get(clampX(x), clampY(y - offset))

  // Use brightness (average of RGB) for gradient
  const getBrightness = (pixel: number[]) => (pixel[0] + pixel[1] + pixel[2]) / 3

  const centerBright = getBrightness(center)
  const rightBright = getBrightness(right)
  const leftBright = getBrightness(left)
  const downBright = getBrightness(down)
  const upBright = getBrightness(up)

  // Calculate gradients (central difference)
  // Positive gradX = flow to the right, negative = flow to left
  // Positive gradY = flow downward, negative = flow upward
  const gradX = (rightBright - leftBright) / (2 * offset)
  const gradY = (downBright - upBright) / (2 * offset)

  // Scale to reasonable velocity magnitude
  // Tuning: Increase velocityScale for stronger response
  const velocityScale = 5.0  // DRAMATICALLY INCREASED from 0.8 - gradients are naturally tiny

  const result = {
    x: gradX * velocityScale,
    y: gradY * velocityScale
  }

  // TEMPORARY DEBUG: Log occasionally to see actual values
  if (Math.random() < 0.001) {  // Log ~0.1% of samples
    console.log('[FLOW] Gradient:', { gradX: gradX.toFixed(4), gradY: gradY.toFixed(4) }, 
                'Velocity:', { x: result.x.toFixed(2), y: result.y.toFixed(2) },
                'Brightness range:', { center: centerBright.toFixed(1), min: Math.min(leftBright, rightBright, upBright, downBright).toFixed(1), max: Math.max(leftBright, rightBright, upBright, downBright).toFixed(1) })
  }

  return result
}

/**
 * Alternative: Direct color sampling (legacy, less robust)
 * Only use if gradient method has issues
 * CAUTION: Coupled to shader brightness value
 */
export function sampleFlowFieldDirect(
  shaderGraphics: any,
  x: number,
  y: number
): Vector2D {
  const pixel = shaderGraphics.get(x, y)

  const vx = (pixel[0] / 255) * 2 - 1
  const vy = (pixel[1] / 255) * 2 - 1

  const velocityScale = 2.0

  return {
    x: vx * velocityScale,
    y: vy * velocityScale
  }
}

/**
 * Decompose a force vector into parallel and perpendicular components
 * relative to a line's direction
 */
export function decomposeForce(
  force: Vector2D,
  lineDirection: Vector2D
): { parallel: number, perpendicular: number } {
  // Parallel component (dot product)
  const parallel = force.x * lineDirection.x + force.y * lineDirection.y

  // Perpendicular component (cross product in 2D)
  const perpendicular = force.x * lineDirection.y - force.y * lineDirection.x

  return { parallel, perpendicular }
}

/**
 * Smooth forces using exponential moving average
 * Prevents jitter from noisy flow field
 */
export function smoothForces(
  cp: ControlPoint,
  config: SpringPhysicsConfig
): void {
  const frames = config.flowField.smoothingFrames

  // Add current forces to history
  cp.forceHistory.parallel.push(cp.parallelForce)
  cp.forceHistory.perpendicular.push(cp.perpendicularForce)

  // Keep only recent history
  if (cp.forceHistory.parallel.length > frames) {
    cp.forceHistory.parallel.shift()
    cp.forceHistory.perpendicular.shift()
  }

  // Average over history
  if (cp.forceHistory.parallel.length > 0) {
    cp.parallelForce = cp.forceHistory.parallel.reduce((a, b) => a + b, 0) / cp.forceHistory.parallel.length
    cp.perpendicularForce = cp.forceHistory.perpendicular.reduce((a, b) => a + b, 0) / cp.forceHistory.perpendicular.length
  }
}

/**
 * Sample flow field for a connection line's control points
 * Applies throttling and force decomposition
 */
export function sampleFlowFieldForConnection(
  connection: { physics: ConnectionLinePhysics },
  shaderGraphics: any,
  particles: Map<string, any>,
  config: SpringPhysicsConfig,
  fromId: string,
  toId: string
): void {
  if (!config.flowField.enabled || !connection.physics) return

  // Throttle sampling based on config sample rate
  const now = Date.now()
  if (now - connection.physics.lastFlowFieldUpdate < 1000 / config.flowField.sampleRate) {
    return
  }
  connection.physics.lastFlowFieldUpdate = now

  const fromParticle = particles.get(fromId)
  const toParticle = particles.get(toId)
  if (!fromParticle || !toParticle) return

  // Sample at parametric positions along the line
  const cp1 = connection.physics.controlPoint1
  const cp2 = connection.physics.controlPoint2

  // Calculate actual positions for sampling
  // Use the straight line positions (not the curved positions)
  const samplePos1 = {
    x: fromParticle.x + (toParticle.x - fromParticle.x) * cp1.t,
    y: fromParticle.y + (toParticle.y - fromParticle.y) * cp1.t
  }

  const samplePos2 = {
    x: fromParticle.x + (toParticle.x - fromParticle.x) * cp2.t,
    y: fromParticle.y + (toParticle.y - fromParticle.y) * cp2.t
  }

  // Sample flow field at both positions
  const flow1 = sampleFlowField(shaderGraphics, samplePos1.x, samplePos1.y)
  const flow2 = sampleFlowField(shaderGraphics, samplePos2.x, samplePos2.y)

  // Decompose into line's coordinate system
  const decomposed1 = decomposeForce(flow1, connection.physics.direction)
  const decomposed2 = decomposeForce(flow2, connection.physics.direction)

  // Apply with length-scaled influence and config strength
  const strength = config.flowField.influenceStrength

  // Control point 1
  const force1Parallel = decomposed1.parallel * strength * cp1.flowFieldInfluence
  const force1Perp = decomposed1.perpendicular * strength * cp1.flowFieldInfluence

  // Control point 2
  const force2Parallel = decomposed2.parallel * strength * cp2.flowFieldInfluence
  const force2Perp = decomposed2.perpendicular * strength * cp2.flowFieldInfluence

  // Add to force accumulators (will be applied in physics update)
  cp1.parallelForce += force1Parallel
  cp1.perpendicularForce += force1Perp

  cp2.parallelForce += force2Parallel
  cp2.perpendicularForce += force2Perp
}
