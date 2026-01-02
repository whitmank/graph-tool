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

  // Canvas dimensions
  const width = 1200
  const height = 800

  // Initialize simulation when nodes/links change
  useEffect(() => {
    if (!nodes.length) {
      console.log('[GraphCanvas] No nodes to display')
      return
    }

    console.log('[GraphCanvas] Initializing with', nodes.length, 'nodes and', links.length, 'links')

    // Initialize node positions if they don't have them
    nodes.forEach(node => {
      if (node.x == null || node.y == null) {
        // Place nodes near center with some randomness
        node.x = width / 2 + (Math.random() - 0.5) * 100
        node.y = height / 2 + (Math.random() - 0.5) * 100
        console.log('[GraphCanvas] Initialized node', node.id, 'at', node.x, node.y)
      } else {
        console.log('[GraphCanvas] Node', node.id, 'already has position', node.x, node.y)
      }
    })

    // Create new simulation
    const simulation = createSimulation(nodes, links, width, height)

    // Store simulation in state so other components can access it
    setSimulation(simulation)

    // Update React on every simulation tick
    let tickCount = 0
    simulation.on('tick', () => {
      tickCount++
      if (tickCount % 60 === 0) {
        console.log('[GraphCanvas] Simulation tick', tickCount, 'alpha:', simulation.alpha().toFixed(3))
      }
      forceUpdate({})  // Force React to re-render with new positions
    })

    // Cleanup
    return () => {
      console.log('[GraphCanvas] Stopping simulation')
      simulation.stop()
    }
  }, [nodes.length, links.length]) // Recreate when data changes

  // Handle canvas click (deselect)
  const handleCanvasClick = () => {
    clearSelection()
  }

  if (!nodes.length) {
    return (
      <div style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>No nodes to display</p>
          <p style={{ fontSize: '14px' }}>Add nodes via the Developer Interface</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      border: '2px solid #cbd5e0',
      borderRadius: '8px',
      backgroundColor: '#ffffff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      display: 'inline-block',
      position: 'relative'
    }}>
      {/* Debug overlay */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace',
        border: '1px solid #e2e8f0',
        zIndex: 1000
      }}>
        Nodes: {nodes.length} | Links: {links.length} | Simulation: {state.simulation ? 'Running' : 'Stopped'}
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        style={{
          backgroundColor: '#f8fafc',
          cursor: 'default',
          display: 'block'
        }}
      >
        {/* Background grid for reference */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" />

        {/* Center crosshair for debugging */}
        <line
          x1={width / 2 - 20}
          y1={height / 2}
          x2={width / 2 + 20}
          y2={height / 2}
          stroke="#94a3b8"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
        <line
          x1={width / 2}
          y1={height / 2 - 20}
          x2={width / 2}
          y2={height / 2 + 20}
          stroke="#94a3b8"
          strokeWidth="1"
          strokeDasharray="2,2"
        />

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
    </div>
  )
}
