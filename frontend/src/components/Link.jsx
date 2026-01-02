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
  const { source, target } = link

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
    <line
      x1={source.x}
      y1={source.y}
      x2={target.x}
      y2={target.y}
      onClick={handleClick}
      className={`link-line ${isSelected ? 'selected' : ''}`}
    />
  )
}
