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
      // Release fixed position - let simulation resume
      node.fx = null
      node.fy = null

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

  return (
    <g
      transform={`translate(${node.x || 0},${node.y || 0})`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className="node-group"
    >
      {/* Node circle */}
      <circle
        r={20}
        className={`node-circle ${isSelected ? 'selected' : ''}`}
      />

      {/* Node label */}
      <text
        y={-28}
        textAnchor="middle"
        className={`node-label ${isSelected ? 'selected' : ''}`}
        pointerEvents="none"
      >
        {node.label}
      </text>

      {/* Optional: URL indicator - minimal dot */}
      {node.url && (
        <circle
          cx={15}
          cy={-15}
          r={3}
          className="node-url-indicator"
        />
      )}
    </g>
  )
}
