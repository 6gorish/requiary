/**
 * Luxury Message Positioning System v2
 * 
 * Key improvements:
 * - Larger bottom padding for taskbars
 * - Focus and Next treated identically for size
 * - Stricter collision detection with logging
 * - Support for position persistence (caching)
 */

export interface ParticleInfo {
  id: string
  x: number
  y: number
  size: number
}

export interface ConnectionInfo {
  fromId: string
  toId: string
}

export interface MessageToPlace {
  id: string
  content: string
  isFocus: boolean
  isNext: boolean
  opacity: number
  isOutgoing?: boolean  // True for outgoing focus (keeps position during fade)
}

export interface PlacedMessage {
  id: string
  content: string
  isFocus: boolean
  isNext: boolean
  opacity: number
  particleX: number
  particleY: number
  particleSize: number
  messageX: number
  messageY: number
  anchorX: number
  anchorY: number
  width: number
  height: number
  quadrant: Quadrant
  textAlign: 'left' | 'right'  // Right-align when message is left of particle
}

type Quadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface BoundingBox {
  left: number
  top: number
  right: number
  bottom: number
}

// Configuration
const CONFIG = {
  particleGap: 15,
  
  // Message dimensions - Focus and Next are SAME SIZE
  charWidth: 12,
  lineHeight: 25,  // Tighter line height (1.15)
  maxWidth: 360,
  minWidth: 180,
  textPadding: 8,
  
  // Screen edge padding - base values, adjusted for mobile
  screenPadding: {
    top: 50,
    left: 40,
    right: 40,
    bottom: 120,  // Extra large for taskbars/docks
  },
  
  // Mobile-specific padding (more generous)
  mobileScreenPadding: {
    top: 70,      // Account for nav bar
    left: 20,     // Tighter sides on mobile
    right: 20,
    bottom: 100,  // Bottom nav/gestures
  },
  
  // Collision resolution
  maxStackOffset: 140,
  stackStep: 55,
  collisionMargin: 20,  // Generous margin between messages
}

/**
 * Get screen padding based on screen size
 */
function getScreenPadding(screenWidth: number): typeof CONFIG.screenPadding {
  // Mobile: width < 768
  if (screenWidth < 768) {
    return CONFIG.mobileScreenPadding
  }
  return CONFIG.screenPadding
}

/**
 * Estimate message dimensions - Focus and Next are IDENTICAL sizes
 * Updated for tighter lineHeight (1.15)
 * Mobile gets smaller max width to avoid overflow
 */
function estimateMessageDimensions(content: string, isFocusOrNext: boolean, screenWidth?: number): { width: number; height: number } {
  // Focus and Next use same sizing
  const charWidth = isFocusOrNext ? 13 : 11
  const lineHeight = isFocusOrNext ? 32 : 25  // Based on lineHeight: 1.15
  
  // Mobile gets smaller max width
  const isMobile = screenWidth !== undefined && screenWidth < 768
  const maxWidth = isMobile ? 280 : CONFIG.maxWidth
  const minWidth = isMobile ? 140 : CONFIG.minWidth
  
  const rawWidth = content.length * charWidth * 0.52
  const width = Math.min(maxWidth, Math.max(minWidth, rawWidth))
  const charsPerLine = width / (charWidth * 0.52)
  const numLines = Math.ceil(content.length / charsPerLine)
  const height = numLines * lineHeight + CONFIG.textPadding * 2
  
  return { width, height }
}

/**
 * Calculate dominant direction of connections FROM a particle
 */
function calculateConnectionDirection(
  particleId: string,
  particles: Map<string, ParticleInfo>,
  connections: ConnectionInfo[]
): { x: number; y: number } {
  const particle = particles.get(particleId)
  if (!particle) return { x: 0, y: 0 }
  
  let totalX = 0, totalY = 0, count = 0
  
  connections.forEach(conn => {
    let otherId: string | null = null
    if (conn.fromId === particleId) otherId = conn.toId
    else if (conn.toId === particleId) otherId = conn.fromId
    
    if (otherId) {
      const other = particles.get(otherId)
      if (other) {
        const dx = other.x - particle.x
        const dy = other.y - particle.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0) {
          const weight = 1 / (dist + 100)
          totalX += (dx / dist) * weight
          totalY += (dy / dist) * weight
          count++
        }
      }
    }
  })
  
  if (count === 0) return { x: 0, y: 0 }
  const mag = Math.sqrt(totalX * totalX + totalY * totalY)
  if (mag === 0) return { x: 0, y: 0 }
  return { x: totalX / mag, y: totalY / mag }
}

/**
 * Choose best quadrant based on connections and screen bounds
 */
function chooseQuadrant(
  particle: ParticleInfo,
  connectionDir: { x: number; y: number },
  screenWidth: number,
  screenHeight: number,
  messageDims: { width: number; height: number }
): Quadrant {
  const scores: Record<Quadrant, number> = {
    'top-left': 0, 'top-right': 0, 'bottom-left': 0, 'bottom-right': 0
  }
  
  const quadrantDirs: Record<Quadrant, { x: number; y: number }> = {
    'top-left': { x: -1, y: -1 },
    'top-right': { x: 1, y: -1 },
    'bottom-left': { x: -1, y: 1 },
    'bottom-right': { x: 1, y: 1 }
  }
  
  // Score OPPOSITE to connection direction (most important)
  for (const [quad, dir] of Object.entries(quadrantDirs)) {
    const dot = dir.x * connectionDir.x + dir.y * connectionDir.y
    scores[quad as Quadrant] += (1 - dot) * 60  // Higher weight
  }
  
  const gap = CONFIG.particleGap
  const screenPadding = getScreenPadding(screenWidth)
  
  // HEAVILY penalize off-screen placements
  if (particle.x - gap - messageDims.width < screenPadding.left) {
    scores['top-left'] -= 300
    scores['bottom-left'] -= 300
  }
  if (particle.x + gap + messageDims.width > screenWidth - screenPadding.right) {
    scores['top-right'] -= 300
    scores['bottom-right'] -= 300
  }
  if (particle.y - gap - messageDims.height < screenPadding.top) {
    scores['top-left'] -= 300
    scores['top-right'] -= 300
  }
  if (particle.y + gap + messageDims.height > screenHeight - screenPadding.bottom) {
    scores['bottom-left'] -= 300
    scores['bottom-right'] -= 300
  }
  
  // Slight preference for right side (reading direction)
  scores['top-right'] += 10
  scores['bottom-right'] += 12
  
  let bestQuad: Quadrant = 'bottom-right'
  let bestScore = -Infinity
  for (const [quad, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      bestQuad = quad as Quadrant
    }
  }
  return bestQuad
}

/**
 * Calculate message position in a given quadrant
 */
function calculatePositionInQuadrant(
  particle: ParticleInfo,
  quadrant: Quadrant,
  dims: { width: number; height: number },
  screenWidth: number,
  screenHeight: number
): { messageX: number; messageY: number; anchorX: number; anchorY: number } {
  const gap = CONFIG.particleGap
  const screenPadding = getScreenPadding(screenWidth)
  
  let messageX: number, messageY: number, anchorX: number, anchorY: number
  
  switch (quadrant) {
    case 'top-left':
      messageX = particle.x - gap - dims.width
      messageY = particle.y - gap - dims.height
      anchorX = messageX + dims.width
      anchorY = messageY + dims.height
      break
    case 'top-right':
      messageX = particle.x + gap
      messageY = particle.y - gap - dims.height
      anchorX = messageX
      anchorY = messageY + dims.height
      break
    case 'bottom-left':
      messageX = particle.x - gap - dims.width
      messageY = particle.y + gap
      anchorX = messageX + dims.width
      anchorY = messageY
      break
    case 'bottom-right':
    default:
      messageX = particle.x + gap
      messageY = particle.y + gap
      anchorX = messageX
      anchorY = messageY
      break
  }
  
  // Clamp to screen with proper edge padding
  messageX = Math.max(screenPadding.left, Math.min(screenWidth - dims.width - screenPadding.right, messageX))
  messageY = Math.max(screenPadding.top, Math.min(screenHeight - dims.height - screenPadding.bottom, messageY))
  
  // Recalculate anchor after clamping
  switch (quadrant) {
    case 'top-left':
      anchorX = messageX + dims.width
      anchorY = messageY + dims.height
      break
    case 'top-right':
      anchorX = messageX
      anchorY = messageY + dims.height
      break
    case 'bottom-left':
      anchorX = messageX + dims.width
      anchorY = messageY
      break
    default:
      anchorX = messageX
      anchorY = messageY
  }
  
  return { messageX, messageY, anchorX, anchorY }
}

/**
 * Check if two boxes overlap with margin
 */
function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  const margin = CONFIG.collisionMargin
  return !(
    a.right + margin < b.left ||
    a.left - margin > b.right ||
    a.bottom + margin < b.top ||
    a.top - margin > b.bottom
  )
}

/**
 * Check if message box overlaps any connection line
 */
function overlapsConnection(
  box: BoundingBox,
  connections: ConnectionInfo[],
  particles: Map<string, ParticleInfo>,
  excludeParticleId: string
): boolean {
  const expanded = {
    left: box.left - 20,
    right: box.right + 20,
    top: box.top - 20,
    bottom: box.bottom + 20
  }
  
  for (const conn of connections) {
    // Skip connections involving this particle
    if (conn.fromId === excludeParticleId || conn.toId === excludeParticleId) continue
    
    const from = particles.get(conn.fromId)
    const to = particles.get(conn.toId)
    if (!from || !to) continue
    
    // Simple line-box intersection test
    if (lineIntersectsBox(from.x, from.y, to.x, to.y, expanded)) {
      return true
    }
  }
  return false
}

function lineIntersectsBox(x1: number, y1: number, x2: number, y2: number, box: BoundingBox): boolean {
  // Check if either endpoint is inside
  const pointIn = (x: number, y: number) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
  if (pointIn(x1, y1) || pointIn(x2, y2)) return true
  
  // Check line-edge intersections
  const edges = [
    [box.left, box.top, box.right, box.top],
    [box.left, box.bottom, box.right, box.bottom],
    [box.left, box.top, box.left, box.bottom],
    [box.right, box.top, box.right, box.bottom]
  ]
  
  for (const [ex1, ey1, ex2, ey2] of edges) {
    const denom = (ey2 - ey1) * (x2 - x1) - (ex2 - ex1) * (y2 - y1)
    if (Math.abs(denom) < 0.0001) continue
    const ua = ((ex2 - ex1) * (y1 - ey1) - (ey2 - ey1) * (x1 - ex1)) / denom
    const ub = ((x2 - x1) * (y1 - ey1) - (y2 - y1) * (x1 - ex1)) / denom
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) return true
  }
  return false
}

/**
 * Main positioning function with collision resolution
 */
export function positionMessages(
  messages: MessageToPlace[],
  particles: Map<string, ParticleInfo>,
  connections: ConnectionInfo[],
  screenWidth: number,
  screenHeight: number,
  existingMessages?: PlacedMessage[]  // NEW: Check collisions against already-visible messages
): PlacedMessage[] {
  const placed: PlacedMessage[] = []
  const placedBoxes: BoundingBox[] = []
  
  // CRITICAL: Add existing visible messages to collision detection
  if (existingMessages) {
    for (const existing of existingMessages) {
      if (existing.opacity > 0.01) {  // Only check against visible messages
        placedBoxes.push({
          left: existing.messageX,
          top: existing.messageY,
          right: existing.messageX + existing.width,
          bottom: existing.messageY + existing.height
        })
      }
    }
  }
  
  // Sort: focus first, then next, then by opacity (most visible = placed first = priority)
  const sorted = [...messages].sort((a, b) => {
    if (a.isFocus && !b.isFocus) return -1
    if (!a.isFocus && b.isFocus) return 1
    if (a.isNext && !b.isNext) return -1
    if (!a.isNext && b.isNext) return 1
    return b.opacity - a.opacity
  })
  
  for (const msg of sorted) {
    const particle = particles.get(msg.id)
    if (!particle) continue
    
    // Focus and Next use same dimensions
    const isFocusOrNext = msg.isFocus || msg.isNext
    const dims = estimateMessageDimensions(msg.content, isFocusOrNext, screenWidth)
    const connectionDir = calculateConnectionDirection(msg.id, particles, connections)
    const preferredQuadrant = chooseQuadrant(particle, connectionDir, screenWidth, screenHeight, dims)
    
    // Try quadrants in order of preference
    const quadrantOrder: Quadrant[] = [preferredQuadrant]
    const allQuadrants: Quadrant[] = ['bottom-right', 'top-right', 'bottom-left', 'top-left']
    for (const q of allQuadrants) {
      if (!quadrantOrder.includes(q)) quadrantOrder.push(q)
    }
    
    let bestPlacement: PlacedMessage | null = null
    let bestScore = -Infinity
    let foundCleanPlacement = false
    
    // Try each quadrant
    for (const quadrant of quadrantOrder) {
      if (foundCleanPlacement) break
      
      const pos = calculatePositionInQuadrant(particle, quadrant, dims, screenWidth, screenHeight)
      const box: BoundingBox = {
        left: pos.messageX,
        top: pos.messageY,
        right: pos.messageX + dims.width,
        bottom: pos.messageY + dims.height
      }
      
      let score = 0
      if (quadrant === preferredQuadrant) score += 50
      
      // Check collision with existing messages
      let hasMessageCollision = false
      for (const existing of placedBoxes) {
        if (boxesOverlap(box, existing)) {
          hasMessageCollision = true
          break
        }
      }
      if (hasMessageCollision) score -= 150
      
      // Check collision with connection lines
      if (overlapsConnection(box, connections, particles, msg.id)) {
        score -= 80
      }
      
      // Prefer positions closer to particle
      const dist = Math.sqrt(
        Math.pow(pos.anchorX - particle.x, 2) +
        Math.pow(pos.anchorY - particle.y, 2)
      )
      score -= dist * 0.1
      
      if (score > bestScore) {
        bestScore = score
        // Text alignment: right-align when message is to the LEFT of particle
        const textAlign = (quadrant === 'top-left' || quadrant === 'bottom-left') ? 'right' : 'left'
        bestPlacement = {
          id: msg.id,
          content: msg.content,
          isFocus: msg.isFocus,
          isNext: msg.isNext,
          opacity: msg.opacity,
          particleX: particle.x,
          particleY: particle.y,
          particleSize: particle.size,
          messageX: pos.messageX,
          messageY: pos.messageY,
          anchorX: pos.anchorX,
          anchorY: pos.anchorY,
          width: dims.width,
          height: dims.height,
          quadrant,
          textAlign
        }
        
        // If no collision at all, this is clean
        if (!hasMessageCollision) {
          foundCleanPlacement = true
        }
      }
    }
    
    // If best placement still has collision, try vertical offsets
    if (bestPlacement && !foundCleanPlacement) {
      const screenPadding = getScreenPadding(screenWidth)
      const baseY = bestPlacement.messageY
      
      for (let offset = CONFIG.stackStep; offset <= CONFIG.maxStackOffset; offset += CONFIG.stackStep) {
        // Try both directions
        for (const direction of [1, -1]) {
          const testY = baseY + offset * direction
          const testBox: BoundingBox = {
            left: bestPlacement.messageX,
            top: testY,
            right: bestPlacement.messageX + dims.width,
            bottom: testY + dims.height
          }
          
          // Check screen bounds
          if (testBox.top < screenPadding.top || testBox.bottom > screenHeight - screenPadding.bottom) {
            continue
          }
          
          // Check for collisions
          let clear = true
          for (const existing of placedBoxes) {
            if (boxesOverlap(testBox, existing)) {
              clear = false
              break
            }
          }
          
          if (clear) {
            bestPlacement.messageY = testY
            // Update anchor based on quadrant
            if (bestPlacement.quadrant.includes('top')) {
              bestPlacement.anchorY = testY + dims.height
            } else {
              bestPlacement.anchorY = testY
            }
            foundCleanPlacement = true
            break
          }
        }
        if (foundCleanPlacement) break
      }
    }
    
    // NUCLEAR OPTION: If still colliding, do a grid search for ANY clear position
    if (bestPlacement && !foundCleanPlacement) {
      const screenPadding = getScreenPadding(screenWidth)
      const gridStep = 60  // Search in 60px increments
      let bestFallbackDist = Infinity
      let fallbackPos: { x: number; y: number } | null = null
      
      // Search the entire screen for a clear position
      for (let testX = screenPadding.left; testX <= screenWidth - dims.width - screenPadding.right; testX += gridStep) {
        for (let testY = screenPadding.top; testY <= screenHeight - dims.height - screenPadding.bottom; testY += gridStep) {
          const testBox: BoundingBox = {
            left: testX,
            top: testY,
            right: testX + dims.width,
            bottom: testY + dims.height
          }
          
          // Check for collisions with placed messages
          let clear = true
          for (const existing of placedBoxes) {
            if (boxesOverlap(testBox, existing)) {
              clear = false
              break
            }
          }
          
          if (clear) {
            // Prefer positions closer to the particle
            const dist = Math.sqrt(
              Math.pow(testX + dims.width / 2 - particle.x, 2) +
              Math.pow(testY + dims.height / 2 - particle.y, 2)
            )
            if (dist < bestFallbackDist) {
              bestFallbackDist = dist
              fallbackPos = { x: testX, y: testY }
            }
          }
        }
      }
      
      if (fallbackPos) {
        bestPlacement.messageX = fallbackPos.x
        bestPlacement.messageY = fallbackPos.y
        // Determine text alignment based on position relative to particle
        bestPlacement.textAlign = fallbackPos.x + dims.width < particle.x ? 'right' : 'left'
        // Update anchor to nearest corner
        if (fallbackPos.x + dims.width < particle.x) {
          bestPlacement.anchorX = fallbackPos.x + dims.width
        } else {
          bestPlacement.anchorX = fallbackPos.x
        }
        if (fallbackPos.y + dims.height < particle.y) {
          bestPlacement.anchorY = fallbackPos.y + dims.height
        } else {
          bestPlacement.anchorY = fallbackPos.y
        }
        foundCleanPlacement = true
      }
    }
    
    if (bestPlacement) {
      placed.push(bestPlacement)
      placedBoxes.push({
        left: bestPlacement.messageX,
        top: bestPlacement.messageY,
        right: bestPlacement.messageX + bestPlacement.width,
        bottom: bestPlacement.messageY + bestPlacement.height
      })
    }
  }
  
  return placed
}
