import { useContext } from 'react'
import { GraphContext } from './GraphContext'

/**
 * Custom hook to access graph state and dispatch
 * Provides convenient access to the GraphContext
 *
 * @returns {Object} { state, dispatch, helpers }
 *
 * @example
 * const { state, dispatch, helpers } = useGraph()
 * const { nodes, links } = state.graph
 * const { selectedNode } = state.ui
 * dispatch({ type: 'SELECT_NODE', payload: nodeId })
 * helpers.selectNode(nodeId) // Alternative to dispatch
 */
export function useGraph() {
  const context = useContext(GraphContext)

  if (!context) {
    throw new Error('useGraph must be used within a GraphProvider')
  }

  const { state, dispatch } = context

  // Helper functions for common actions
  const helpers = {
    // Node selection
    selectNode: (nodeId) => dispatch({ type: 'SELECT_NODE', payload: nodeId }),
    selectLink: (linkId) => dispatch({ type: 'SELECT_LINK', payload: linkId }),
    clearSelection: () => dispatch({ type: 'CLEAR_SELECTION' }),

    // Node operations
    addNode: (node) => dispatch({ type: 'ADD_NODE', payload: node }),
    updateNode: (node) => dispatch({ type: 'UPDATE_NODE', payload: node }),
    deleteNode: (nodeId) => dispatch({ type: 'DELETE_NODE', payload: nodeId }),
    updateNodePosition: (nodeId, x, y) =>
      dispatch({ type: 'UPDATE_NODE_POSITION', payload: { id: nodeId, x, y } }),

    // Link operations
    addLink: (link) => dispatch({ type: 'ADD_LINK', payload: link }),
    updateLink: (link) => dispatch({ type: 'UPDATE_LINK', payload: link }),
    deleteLink: (linkId) => dispatch({ type: 'DELETE_LINK', payload: linkId }),

    // Link creation UI flow
    startAddingLink: (sourceNodeId) =>
      dispatch({ type: 'START_ADDING_LINK', payload: sourceNodeId }),
    cancelAddingLink: () => dispatch({ type: 'CANCEL_ADDING_LINK' }),

    // Simulation
    setSimulation: (simulation) =>
      dispatch({ type: 'SET_SIMULATION', payload: simulation }),
    stopSimulation: () => dispatch({ type: 'STOP_SIMULATION' }),

    // Error handling
    setError: (error) => dispatch({ type: 'SET_ERROR', payload: error }),
    clearError: () => dispatch({ type: 'CLEAR_ERROR' })
  }

  return {
    state,
    dispatch,
    ...helpers
  }
}
