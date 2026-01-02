import * as d3 from 'd3'

/**
 * Create and configure a D3 force simulation
 *
 * @param {Array} nodes - Array of node objects with {id, label, x, y}
 * @param {Array} links - Array of link objects with {id, source_id, target_id}
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} D3 force simulation instance
 */
export function createSimulation(nodes, links, width, height) {
  // Transform links to use D3's expected format (source/target instead of source_id/target_id)
  const d3Links = links.map(link => ({
    ...link,
    source: link.source_id,
    target: link.target_id
  }))

  // Create the simulation with nodes
  const simulation = d3.forceSimulation(nodes)
    // Links: Spring forces between connected nodes
    .force('link', d3.forceLink(d3Links)
      .id(d => d.id)
      .distance(150)  // Desired link length
      .strength(0.5)  // Spring stiffness
    )
    // Charge: Repulsion between all nodes
    .force('charge', d3.forceManyBody()
      .strength(-400)  // Negative = repulsion (increased for visibility)
    )
    // Center: Strong gravity toward canvas center
    .force('center', d3.forceCenter(width / 2, height / 2)
      .strength(0.1)  // Stronger pull toward center
    )
    // Collide: Prevent node overlap
    .force('collide', d3.forceCollide()
      .radius(30)  // Collision buffer around each node
      .strength(0.8)
    )
    // Simulation settings
    .alphaDecay(0.01)  // Slower cooling = more settling time
    .velocityDecay(0.4)  // More friction = slower movement

  return simulation
}

/**
 * Reheat the simulation to restart physics
 * Useful after manual node repositioning
 *
 * @param {Object} simulation - D3 simulation instance
 */
export function reheatSimulation(simulation) {
  if (!simulation) return

  simulation
    .alpha(0.3)  // Set energy level
    .restart()   // Resume simulation
}

/**
 * Stop the simulation completely
 *
 * @param {Object} simulation - D3 simulation instance
 */
export function stopSimulation(simulation) {
  if (!simulation) return

  simulation.stop()
}
