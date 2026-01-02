import { useGraph } from '../store/useGraph'

/**
 * Node component - Renders a single node with drag support
 *
 * Integrates with D3 simulation:
 * - During drag: node.fx/fy fix the position
 * - After drag: node.fx/fy are cleared so simulation resumes
 */
export default function Node({ node, simulation }) {
  const { state, selectNode } = useGraph()

  const isSelected = state.ui.selectedNode === node.id

  const handleMouseDown = (e) => {
    // Fix node position during drag
    node.fx = node.x
    node.fy = node.y

    const handleMouseMove = (moveEvent) => {
      // Get SVG coordinates
      const svg = e.target.ownerSVGElement
      const pt = svg.createSVGPoint()
      pt.x = moveEvent.clientX
      pt.y = moveEvent.clientY
      const svgP = pt.matrixTransform(svg.getScreenCTM().inverse())

      // Update fixed position
      node.fx = svgP.x
      node.fy = svgP.y

      // Reheat simulation
      if (simulation) {
        simulation.alpha(0.3).restart()
      }
    }

    const handleMouseUp = () => {
      // Release fixed position
      node.fx = null
      node.fy = null

      // Save position to backend
      saveNodePosition(node.id, node.x, node.y)

      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleClick = (e) => {
    e.stopPropagation()
    selectNode(node.id)
  }

  const saveNodePosition = async (nodeId, x, y) => {
    try {
      await fetch(`/api/nodes/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y })
      })
    } catch (error) {
      console.error('Failed to save node position:', error)
    }
  }

  return (
    <g
      transform={`translate(${node.x || 0},${node.y || 0})`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      style={{ cursor: 'grab' }}
    >
      {/* Node circle */}
      <circle
        r={20}
        fill={isSelected ? '#3b82f6' : '#e2e8f0'}
        stroke={isSelected ? '#1e40af' : '#64748b'}
        strokeWidth={2}
      />

      {/* Node label */}
      <text
        y={-28}
        textAnchor="middle"
        fontSize={14}
        fontWeight={isSelected ? 'bold' : 'normal'}
        fill="#1e293b"
        pointerEvents="none"
      >
        {node.label}
      </text>

      {/* Optional: URL indicator */}
      {node.url && (
        <circle
          cx={12}
          cy={-12}
          r={4}
          fill="#10b981"
          stroke="white"
          strokeWidth={1}
        />
      )}
    </g>
  )
}
