import { useGraph } from '../store/useGraph'

/**
 * Link component - Renders a connection between two nodes
 *
 * D3 automatically replaces source_id/target_id strings with node object references
 * So link.source and link.target are actual node objects with x, y coordinates
 */
export default function Link({ link }) {
  const { state, selectLink } = useGraph()

  // D3 transforms source_id/target_id into node object references
  const source = link.source
  const target = link.target

  // Handle cases where D3 hasn't transformed yet or nodes don't exist
  if (!source || !target || typeof source !== 'object' || typeof target !== 'object') {
    return null
  }

  const isSelected = state.ui.selectedLink === link.id

  const handleClick = (e) => {
    e.stopPropagation()
    selectLink(link.id)
  }

  return (
    <g onClick={handleClick} style={{ cursor: 'pointer' }}>
      {/* Main link line */}
      <line
        x1={source.x}
        y1={source.y}
        x2={target.x}
        y2={target.y}
        stroke={isSelected ? '#3b82f6' : '#94a3b8'}
        strokeWidth={isSelected ? 3 : 2}
        strokeOpacity={0.6}
      />

      {/* Invisible wider line for easier clicking */}
      <line
        x1={source.x}
        y1={source.y}
        x2={target.x}
        y2={target.y}
        stroke="transparent"
        strokeWidth={10}
      />

      {/* Optional: Link label */}
      {link.label && (
        <text
          x={(source.x + target.x) / 2}
          y={(source.y + target.y) / 2}
          textAnchor="middle"
          fontSize={11}
          fill="#64748b"
          pointerEvents="none"
        >
          {link.label}
        </text>
      )}
    </g>
  )
}
