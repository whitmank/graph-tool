import { useEffect, useRef, useState } from 'react'
import { useGraph } from '../store/useGraph'
import { createSimulation } from '../engine/forceSimulation'
import Node from './Node'
import Link from './Link'

/**
 * GraphCanvas - Main SVG container for force-directed graph visualization
 *
 * Responsibilities:
 * - Initialize D3 simulation
 * - Handle simulation tick updates
 * - Render nodes and links
 * - Manage canvas interactions (click to deselect)
 */
export default function GraphCanvas() {
  const { state, setSimulation, clearSelection, dispatch } = useGraph()
  const { nodes, links } = state.graph
  const svgRef = useRef(null)
  const [, forceUpdate] = useState({})

  // Fixed canvas dimensions for viewBox
  const width = 1200
  const height = 800

  // Initialize simulation when nodes/links change
  useEffect(() => {
    if (!nodes.length) return

    // Initialize node positions randomly (always reset, never use DB positions)
    nodes.forEach(node => {
      // Place nodes near center with some randomness
      node.x = width / 2 + (Math.random() - 0.5) * 100
      node.y = height / 2 + (Math.random() - 0.5) * 100
    })

    // Create new simulation
    const simulation = createSimulation(nodes, links, width, height)

    // Store simulation in state so other components can access it
    setSimulation(simulation)

    // Update React on every simulation tick
    simulation.on('tick', () => {
      forceUpdate({})  // Force React to re-render with new positions
    })

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [nodes.length, links.length]) // Recreate when data changes

  // Handle canvas click (deselect)
  const handleCanvasClick = () => {
    clearSelection()
  }

  if (!nodes.length) {
    return (
      <div className="graph-canvas-empty">
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>No nodes to display</p>
        </div>
      </div>
    )
  }

  return (
    <svg
      ref={svgRef}
      className="graph-canvas"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      onClick={handleCanvasClick}
    >
      {/* Render links first (so they appear behind nodes) */}
      <g className="links">
        {links.map(link => (
          <Link key={link.id} link={link} />
        ))}
      </g>

      {/* Render nodes */}
      <g className="nodes">
        {nodes.map(node => (
          <Node
            key={node.id}
            node={node}
            simulation={state.simulation}
          />
        ))}
      </g>
    </svg>
  )
}
