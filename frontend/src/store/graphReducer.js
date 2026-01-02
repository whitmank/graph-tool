/**
 * Graph Reducer - Handles all state mutations for the graph
 *
 * State shape:
 * {
 *   graph: { nodes: [], links: [] },
 *   ui: {
 *     selectedNode: id | null,
 *     selectedLink: id | null,
 *     isAddingLink: false,
 *     linkSourceNode: id | null,
 *     error: string | null
 *   },
 *   simulation: d3.forceSimulation() | null
 * }
 */

export const initialState = {
  graph: {
    nodes: [],
    links: []
  },
  ui: {
    selectedNode: null,
    selectedLink: null,
    isAddingLink: false,
    linkSourceNode: null,
    error: null
  },
  simulation: null
}

export default function graphReducer(state, action) {
  switch (action.type) {
    // ========================================
    // Data Loading Actions
    // ========================================

    case 'LOAD_NODES':
      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: action.payload
        }
      }

    case 'LOAD_LINKS':
      return {
        ...state,
        graph: {
          ...state.graph,
          links: action.payload
        }
      }

    case 'LOAD_GRAPH':
      // Load both nodes and links at once
      return {
        ...state,
        graph: {
          nodes: action.payload.nodes || [],
          links: action.payload.links || []
        }
      }

    // ========================================
    // Node Actions
    // ========================================

    case 'ADD_NODE':
      // Note: Node creation happens via API call in component
      // This action updates state after successful API response
      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: [...state.graph.nodes, action.payload]
        }
      }

    case 'UPDATE_NODE':
      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: state.graph.nodes.map(node =>
            node.id === action.payload.id
              ? { ...node, ...action.payload }
              : node
          )
        }
      }

    case 'DELETE_NODE':
      // Also remove any links connected to this node
      const nodeId = action.payload
      return {
        ...state,
        graph: {
          nodes: state.graph.nodes.filter(node => node.id !== nodeId),
          links: state.graph.links.filter(
            link => link.source_id !== nodeId && link.target_id !== nodeId
          )
        },
        ui: {
          ...state.ui,
          selectedNode: state.ui.selectedNode === nodeId ? null : state.ui.selectedNode
        }
      }

    case 'UPDATE_NODE_POSITION':
      // Update x, y coordinates from simulation
      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: state.graph.nodes.map(node =>
            node.id === action.payload.id
              ? { ...node, x: action.payload.x, y: action.payload.y }
              : node
          )
        }
      }

    case 'UPDATE_POSITIONS':
      // Batch update all node positions (simulation tick)
      const positionMap = new Map(
        action.payload.map(n => [n.id, { x: n.x, y: n.y }])
      )
      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: state.graph.nodes.map(node => {
            const pos = positionMap.get(node.id)
            return pos ? { ...node, ...pos } : node
          })
        }
      }

    // ========================================
    // Link Actions
    // ========================================

    case 'ADD_LINK':
      // Note: Link creation happens via API call in component
      // This action updates state after successful API response
      return {
        ...state,
        graph: {
          ...state.graph,
          links: [...state.graph.links, action.payload]
        }
      }

    case 'UPDATE_LINK':
      return {
        ...state,
        graph: {
          ...state.graph,
          links: state.graph.links.map(link =>
            link.id === action.payload.id
              ? { ...link, ...action.payload }
              : link
          )
        }
      }

    case 'DELETE_LINK':
      const linkId = action.payload
      return {
        ...state,
        graph: {
          ...state.graph,
          links: state.graph.links.filter(link => link.id !== linkId)
        },
        ui: {
          ...state.ui,
          selectedLink: state.ui.selectedLink === linkId ? null : state.ui.selectedLink
        }
      }

    // ========================================
    // UI/Selection Actions
    // ========================================

    case 'SELECT_NODE':
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedNode: action.payload,
          selectedLink: null // Clear link selection
        }
      }

    case 'SELECT_LINK':
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedLink: action.payload,
          selectedNode: null // Clear node selection
        }
      }

    case 'CLEAR_SELECTION':
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedNode: null,
          selectedLink: null
        }
      }

    case 'START_ADDING_LINK':
      // Enter link creation mode with source node
      return {
        ...state,
        ui: {
          ...state.ui,
          isAddingLink: true,
          linkSourceNode: action.payload
        }
      }

    case 'CANCEL_ADDING_LINK':
      // Exit link creation mode
      return {
        ...state,
        ui: {
          ...state.ui,
          isAddingLink: false,
          linkSourceNode: null
        }
      }

    case 'SET_ERROR':
      return {
        ...state,
        ui: {
          ...state.ui,
          error: action.payload
        }
      }

    case 'CLEAR_ERROR':
      return {
        ...state,
        ui: {
          ...state.ui,
          error: null
        }
      }

    // ========================================
    // Simulation Actions
    // ========================================

    case 'SET_SIMULATION':
      // Store reference to D3 simulation instance
      return {
        ...state,
        simulation: action.payload
      }

    case 'STOP_SIMULATION':
      if (state.simulation) {
        state.simulation.stop()
      }
      return {
        ...state,
        simulation: null
      }

    // ========================================
    // Default
    // ========================================

    default:
      console.warn(`Unknown action type: ${action.type}`)
      return state
  }
}
