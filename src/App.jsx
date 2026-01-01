import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './App.css'

function App() {
  const [nodes, setNodes] = useState([])
  const [links, setLinks] = useState([])

  // Load data on component mount
  useEffect(() => {
    loadNodes()
    loadLinks()
  }, [])

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000')

    ws.onopen = () => {
      console.log('[WebSocket] Connected to server')
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      console.log('[WebSocket] Received:', message)

      if (message.type === 'node') {
        loadNodes()
        if (message.action === 'deleted') {
          loadLinks()
        }
      } else if (message.type === 'link') {
        loadLinks()
      }
    }

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error)
    }

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected from server')
    }

    return () => {
      ws.close()
    }
  }, [])

  const loadNodes = async () => {
    try {
      const response = await fetch('/api/nodes')
      const data = await response.json()
      setNodes(data)
    } catch (error) {
      console.error('Failed to load nodes:', error)
    }
  }

  const loadLinks = async () => {
    try {
      const response = await fetch('/api/links')
      const data = await response.json()
      setLinks(data)
    } catch (error) {
      console.error('Failed to load links:', error)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>GraphTool</h1>
        <div className="status">
          <span className="count">{nodes.length} nodes, {links.length} links</span>
          <Link to="/dev" className="dev-link">Developer Interface →</Link>
        </div>
      </header>

      <main className="main">
        <div className="placeholder">
          <h2>New Frontend Coming Soon</h2>
          <p>Graph visualization interface will be built here</p>
          <p>Current data: {nodes.length} nodes, {links.length} links</p>
        </div>
      </main>
    </div>
  )
}

export default App
