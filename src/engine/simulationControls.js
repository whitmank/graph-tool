/**
 * Dynamic simulation controls for adding/removing nodes and links
 * These functions allow updating the simulation without recreating it
 */

/**
 * Add a new node to the simulation
 *
 * @param {Object} simulation - D3 simulation instance
 * @param {Object} node - Node object to add
 */
export function addNode(simulation, node) {
  if (!simulation) return

  const nodes = simulation.nodes()
  nodes.push(node)
  simulation.nodes(nodes)
  simulation.alpha(0.3).restart()
}

/**
 * Remove a node from the simulation
 *
 * @param {Object} simulation - D3 simulation instance
 * @param {string} nodeId - ID of node to remove
 */
export function removeNode(simulation, nodeId) {
  if (!simulation) return

  const nodes = simulation.nodes().filter(n => n.id !== nodeId)
  simulation.nodes(nodes)
  simulation.alpha(0.3).restart()
}

/**
 * Add a new link to the simulation
 *
 * @param {Object} simulation - D3 simulation instance
 * @param {Object} link - Link object to add (must have source_id and target_id)
 */
export function addLink(simulation, link) {
  if (!simulation) return

  const linkForce = simulation.force('link')
  if (!linkForce) return

  // Transform to D3 format
  const d3Link = {
    ...link,
    source: link.source_id,
    target: link.target_id
  }

  const currentLinks = linkForce.links()
  currentLinks.push(d3Link)
  linkForce.links(currentLinks)
  simulation.alpha(0.3).restart()
}

/**
 * Remove a link from the simulation
 *
 * @param {Object} simulation - D3 simulation instance
 * @param {string} linkId - ID of link to remove
 */
export function removeLink(simulation, linkId) {
  if (!simulation) return

  const linkForce = simulation.force('link')
  if (!linkForce) return

  const currentLinks = linkForce.links().filter(l => l.id !== linkId)
  linkForce.links(currentLinks)
  simulation.alpha(0.3).restart()
}

/**
 * Update simulation size (when canvas resizes)
 *
 * @param {Object} simulation - D3 simulation instance
 * @param {number} width - New width
 * @param {number} height - New height
 */
export function updateSimulationSize(simulation, width, height) {
  if (!simulation) return

  const centerForce = simulation.force('center')
  if (centerForce) {
    centerForce.x(width / 2).y(height / 2)
    simulation.alpha(0.3).restart()
  }
}
