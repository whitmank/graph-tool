import { createContext, useReducer, useEffect, useRef } from 'react'
import graphReducer, { initialState } from './graphReducer'

export const GraphContext = createContext()

/**
 * GraphProvider - Context provider for global graph state
 *
 * Provides state and dispatch to all child components.
 * Handles initial data loading and WebSocket connection.
 */
export function GraphProvider({ children }) {
  const [state, dispatch] = useReducer(graphReducer, initialState)
  const wsRef = useRef(null)

  // Load initial data from API
  useEffect(() => {
    loadGraphData()
  }, [])

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000')

    ws.onopen = () => {
      console.log('[GraphContext] WebSocket connected')
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      console.log('[GraphContext] WebSocket message:', message)

      // Reload data when changes occur
      if (message.type === 'node') {
        loadNodes()
        if (message.action === 'deleted') {
          // Node deletion cascades to links, reload both
          loadLinks()
        }
      } else if (message.type === 'link') {
        loadLinks()
      } else if (message.type === 'system' && message.action === 'reload') {
        // Data source switched, reload everything
        console.log('[GraphContext] Data source switched, reloading all data')
        loadGraphData()
      }
    }

    ws.onerror = (error) => {
      console.error('[GraphContext] WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('[GraphContext] WebSocket disconnected')
    }

    wsRef.current = ws

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // Load both nodes and links
  const loadGraphData = async () => {
    await Promise.all([loadNodes(), loadLinks()])
  }

  // Load nodes from API
  const loadNodes = async () => {
    try {
      const response = await fetch('/api/nodes')
      if (!response.ok) {
        throw new Error(`Failed to load nodes: ${response.statusText}`)
      }
      const nodes = await response.json()
      dispatch({ type: 'LOAD_NODES', payload: nodes })
    } catch (error) {
      console.error('[GraphContext] Error loading nodes:', error)
      dispatch({ type: 'SET_ERROR', payload: error.message })
    }
  }

  // Load links from API
  const loadLinks = async () => {
    try {
      const response = await fetch('/api/links')
      if (!response.ok) {
        throw new Error(`Failed to load links: ${response.statusText}`)
      }
      const links = await response.json()
      dispatch({ type: 'LOAD_LINKS', payload: links })
    } catch (error) {
      console.error('[GraphContext] Error loading links:', error)
      dispatch({ type: 'SET_ERROR', payload: error.message })
    }
  }

  return (
    <GraphContext.Provider value={{ state, dispatch }}>
      {children}
    </GraphContext.Provider>
  )
}
