import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './DevInterface.css'

function DevInterface() {
  // State management
  const [connected, setConnected] = useState(true)
  const [nodes, setNodes] = useState([])
  const [links, setLinks] = useState([])
  const [view, setView] = useState('nodes') // 'nodes', 'links', or 'sources'
  const [formData, setFormData] = useState({ label: '', url: '' })
  const [linkFormData, setLinkFormData] = useState({ source_id: '', target_id: '', label: '' })
  const [editingId, setEditingId] = useState(null)

  // Data source management
  const [dataSources, setDataSources] = useState({})
  const [currentSource, setCurrentSource] = useState(null)
  const [switching, setSwitching] = useState(false)
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0)

  // Load data on component mount
  useEffect(() => {
    loadNodes()
    loadLinks()
    loadDataSources()
    loadCurrentSource()
  }, [])

  // Keyboard navigation for data sources view
  useEffect(() => {
    if (view !== 'sources') return

    const handleKeyDown = (e) => {
      const sourceIds = Object.keys(dataSources)
      if (sourceIds.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSourceIndex(prev => Math.min(prev + 1, sourceIds.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSourceIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selectedId = sourceIds[selectedSourceIndex]
        if (selectedId && selectedId !== currentSource?.id) {
          handleSwitchSource(selectedId)
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedId = sourceIds[selectedSourceIndex]
        // Can only delete if not active and not default
        if (selectedId && selectedId !== currentSource?.id && selectedId !== 'default') {
          e.preventDefault()
          handleDeleteSource(selectedId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, dataSources, selectedSourceIndex, currentSource])

  // Reset selected index when switching to sources view
  useEffect(() => {
    if (view === 'sources') {
      const sourceIds = Object.keys(dataSources)
      const currentIndex = sourceIds.findIndex(id => id === currentSource?.id)
      setSelectedSourceIndex(currentIndex >= 0 ? currentIndex : 0)
    }
  }, [view, currentSource, dataSources])

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000')

    ws.onopen = () => {
      console.log('[WebSocket] Connected to server')
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      console.log('[WebSocket] Received:', message)

      // Reload data when external changes detected
      if (message.type === 'node') {
        loadNodes()
        // If a node was deleted, also reload links (cascade delete)
        if (message.action === 'deleted') {
          loadLinks()
        }
      } else if (message.type === 'link') {
        loadLinks()
      } else if (message.type === 'system' && message.action === 'reload') {
        // Data source was switched, reload everything
        console.log('[WebSocket] Data source switched, reloading...')
        loadNodes()
        loadLinks()
        loadDataSources()
        loadCurrentSource()
      }
    }

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error)
    }

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected from server')
    }

    // Cleanup on unmount
    return () => {
      ws.close()
    }
  }, [])

  // Fetch all nodes from the backend
  const loadNodes = async () => {
    try {
      const response = await fetch('/api/nodes')
      const data = await response.json()
      setNodes(data)
    } catch (error) {
      console.error('Failed to load nodes:', error)
    }
  }

  // Fetch all links from the backend
  const loadLinks = async () => {
    try {
      const response = await fetch('/api/links')
      const data = await response.json()
      setLinks(data)
    } catch (error) {
      console.error('Failed to load links:', error)
    }
  }

  // Fetch all data sources
  const loadDataSources = async () => {
    try {
      const response = await fetch('/api/data-sources')
      const data = await response.json()
      setDataSources(data)
    } catch (error) {
      console.error('Failed to load data sources:', error)
    }
  }

  // Fetch current active data source
  const loadCurrentSource = async () => {
    try {
      const response = await fetch('/api/data-sources/current')
      const data = await response.json()
      setCurrentSource(data)
    } catch (error) {
      console.error('Failed to load current source:', error)
    }
  }

  // Switch to a different data source
  const handleSwitchSource = async (sourceId) => {
    if (sourceId === currentSource?.id) return

    try {
      setSwitching(true)
      const response = await fetch('/api/data-sources/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to switch data source')
      }

      // Reload will happen automatically via WebSocket
      console.log('Data source switch initiated')
    } catch (error) {
      console.error('Failed to switch data source:', error)
      alert(`Failed to switch data source: ${error.message}`)
    } finally {
      setSwitching(false)
    }
  }

  // Open native directory picker and automatically add all subdirectories as data sources
  const handleOpenDirectoryPicker = async () => {
    try {
      // Open native macOS Finder dialog
      const pickerResponse = await fetch('/api/data-sources/pick-directory')
      const pickerData = await pickerResponse.json()

      if (pickerData.cancelled) {
        // User cancelled the picker
        return
      }

      if (pickerData.subdirectories && pickerData.subdirectories.length > 0) {
        // Add each subdirectory as a data source
        const addedSources = []
        const failedSources = []

        for (const subdir of pickerData.subdirectories) {
          const generatedId = subdir.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')

          try {
            const createResponse = await fetch('/api/data-sources', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: generatedId,
                name: subdir.name,
                path: subdir.path,
                description: `From ${pickerData.parentPath}`
              })
            })

            if (createResponse.ok) {
              addedSources.push(subdir.name)
            } else {
              const error = await createResponse.json()
              failedSources.push({ name: subdir.name, error: error.error })
            }
          } catch (err) {
            failedSources.push({ name: subdir.name, error: err.message })
          }
        }

        // Reload data sources list
        await loadDataSources()

        // Show summary
        if (addedSources.length > 0) {
          console.log(`Added ${addedSources.length} data sources:`, addedSources)
        }
        if (failedSources.length > 0) {
          console.error(`Failed to add ${failedSources.length} sources:`, failedSources)
          alert(`Added ${addedSources.length} sources. Failed to add ${failedSources.length} sources (check console for details)`)
        }
      } else {
        alert('No subdirectories found in selected directory')
      }
    } catch (error) {
      console.error('Failed to add data sources:', error)
      alert(`Failed to add data sources: ${error.message}`)
    }
  }

  // Delete a data source
  const handleDeleteSource = async (sourceId) => {
    try {
      const response = await fetch(`/api/data-sources/${sourceId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete data source')
      }

      await loadDataSources()

      // Adjust selected index if needed
      const sourceIds = Object.keys(dataSources)
      const deletedIndex = sourceIds.findIndex(id => id === sourceId)
      if (deletedIndex === selectedSourceIndex && selectedSourceIndex > 0) {
        setSelectedSourceIndex(prev => prev - 1)
      }
    } catch (error) {
      console.error('Failed to delete data source:', error)
      alert(`Failed to delete data source: ${error.message}`)
    }
  }

  // Handler functions for nodes
  const handleConnect = () => {
    setConnected(!connected)
    if (!connected) {
      loadNodes()
      loadLinks()
    }
  }

  const handleAddNode = async (e) => {
    e.preventDefault()
    if (!formData.label) return

    try {
      await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      setFormData({ label: '', url: '' })
      await loadNodes()
    } catch (error) {
      console.error('Failed to add node:', error)
    }
  }

  const handleEditNode = (node) => {
    setEditingId(node.id)
    setFormData({ label: node.label, url: node.url || '' })
  }

  const handleUpdateNode = async (e) => {
    e.preventDefault()

    try {
      await fetch(`/api/nodes/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      setEditingId(null)
      setFormData({ label: '', url: '' })
      await loadNodes()
    } catch (error) {
      console.error('Failed to update node:', error)
    }
  }

  const handleDeleteNode = async (id) => {
    try {
      await fetch(`/api/nodes/${id}`, { method: 'DELETE' })
      await loadNodes()
      await loadLinks() // Reload links since they may have been deleted
    } catch (error) {
      console.error('Failed to delete node:', error)
    }
  }

  // Handler functions for links
  const handleAddLink = async (e) => {
    e.preventDefault()
    if (!linkFormData.source_id || !linkFormData.target_id) return

    try {
      await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkFormData)
      })
      setLinkFormData({ source_id: '', target_id: '', label: '' })
      await loadLinks()
    } catch (error) {
      console.error('Failed to add link:', error)
    }
  }

  const handleDeleteLink = async (id) => {
    try {
      await fetch(`/api/links/${id}`, { method: 'DELETE' })
      await loadLinks()
    } catch (error) {
      console.error('Failed to delete link:', error)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setFormData({ label: '', url: '' })
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" style={{ color: '#4ade80', textDecoration: 'none', fontSize: '1.2rem' }}>←</Link>
          <h1>GraphTool Manager</h1>
        </div>

        {/* Data Source Switcher */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#888' }}>Active Source</span>
          <select
            value={currentSource?.id || ''}
            onChange={(e) => handleSwitchSource(e.target.value)}
            disabled={switching}
            style={{
              background: '#2a2a2a',
              color: '#e0e0e0',
              border: '1px solid #3a3a3a',
              borderRadius: '4px',
              padding: '0.4rem 0.6rem',
              fontSize: '0.875rem',
              cursor: switching ? 'wait' : 'pointer'
            }}
          >
            {Object.entries(dataSources).map(([id, source]) => (
              <option key={id} value={id}>
                {switching && id === currentSource?.id ? '⏳ ' : ''}{source.name}
              </option>
            ))}
          </select>
        </div>

        <div className="status">
          <span className={`indicator ${connected ? 'connected' : ''}`}>
            {connected ? '●' : '○'}
          </span>
          <button onClick={handleConnect} className="btn-connect">
            {connected ? 'Connected' : 'Disconnected'}
          </button>
        </div>
      </header>

      <main className="main">
        {/* View Toggle */}
        <div className="view-toggle">
          <button
            className={view === 'nodes' ? 'active' : ''}
            onClick={() => setView('nodes')}
          >
            Nodes ({nodes.length})
          </button>
          <button
            className={view === 'links' ? 'active' : ''}
            onClick={() => setView('links')}
          >
            Links ({links.length})
          </button>
          <button
            className={view === 'sources' ? 'active' : ''}
            onClick={() => setView('sources')}
          >
            Data Sources ({Object.keys(dataSources).length})
          </button>
        </div>

        {/* Nodes View */}
        {view === 'nodes' && (
          <>
            {/* Node Form */}
            <section className="form-section">
              <form onSubmit={editingId ? handleUpdateNode : handleAddNode} className="compact-form">
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Label (required)"
                  required
                />
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="URL (optional)"
                />
                <button type="submit" className="btn-primary">
                  {editingId ? 'Update' : 'Add Node'}
                </button>
                {editingId && (
                  <button type="button" onClick={handleCancel} className="btn-cancel">
                    Cancel
                  </button>
                )}
              </form>
            </section>

            {/* Nodes Table */}
            <section className="records-section">
              <div className="section-header">
                <h2>Nodes</h2>
                <span className="count">{nodes.length}</span>
              </div>
              {nodes.length === 0 ? (
                <p className="empty">No nodes</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Label</th>
                        <th>URL</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map(node => (
                        <tr key={node.id}>
                          <td className="id-cell">{node.id}</td>
                          <td>{node.label}</td>
                          <td>
                            {node.url ? (
                              <a href={node.url} target="_blank" rel="noopener noreferrer">
                                {node.url}
                              </a>
                            ) : (
                              <span className="no-url">—</span>
                            )}
                          </td>
                          <td className="actions">
                            <button onClick={() => handleEditNode(node)} className="btn-edit">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteNode(node.id)} className="btn-delete">
                              Del
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* Links View */}
        {view === 'links' && (
          <>
            {/* Link Form */}
            <section className="form-section">
              <form onSubmit={handleAddLink} className="compact-form">
                <select
                  value={linkFormData.source_id}
                  onChange={(e) => setLinkFormData({ ...linkFormData, source_id: e.target.value })}
                  required
                >
                  <option value="">Source Node</option>
                  {nodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.label} ({node.id})
                    </option>
                  ))}
                </select>
                <select
                  value={linkFormData.target_id}
                  onChange={(e) => setLinkFormData({ ...linkFormData, target_id: e.target.value })}
                  required
                >
                  <option value="">Target Node</option>
                  {nodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.label} ({node.id})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={linkFormData.label}
                  onChange={(e) => setLinkFormData({ ...linkFormData, label: e.target.value })}
                  placeholder="Relationship label (optional)"
                />
                <button type="submit" className="btn-primary">
                  Add Link
                </button>
              </form>
            </section>

            {/* Links Table */}
            <section className="records-section">
              <div className="section-header">
                <h2>Links</h2>
                <span className="count">{links.length}</span>
              </div>
              {links.length === 0 ? (
                <p className="empty">No links</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Source</th>
                        <th>Target</th>
                        <th>Label</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {links.map(link => (
                        <tr key={link.id}>
                          <td className="id-cell">{link.id}</td>
                          <td className="id-cell">{link.source_id}</td>
                          <td className="id-cell">{link.target_id}</td>
                          <td>{link.label || '—'}</td>
                          <td className="actions">
                            <button onClick={() => handleDeleteLink(link.id)} className="btn-delete">
                              Del
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* Data Sources View */}
        {view === 'sources' && (
          <>
            {/* Data Sources Table */}
            <section className="records-section">
              <div className="section-header">
                <h2>Data Sources</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span className="count">{Object.keys(dataSources).length}</span>
                  <button
                    onClick={handleOpenDirectoryPicker}
                    className="btn-primary"
                    style={{ fontSize: '0.875rem' }}
                  >
                    + Scan Directory
                  </button>
                </div>
              </div>
              {Object.keys(dataSources).length === 0 ? (
                <p className="empty">No data sources</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Path</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(dataSources).map(([id, source], index) => {
                        const isActive = id === currentSource?.id
                        const isSelected = index === selectedSourceIndex

                        return (
                          <tr
                            key={id}
                            onClick={() => {
                              if (id !== currentSource?.id) {
                                handleSwitchSource(id)
                              }
                            }}
                            onMouseEnter={() => setSelectedSourceIndex(index)}
                            style={{
                              background: isActive ? '#2a3a2a' : isSelected ? '#252525' : 'transparent',
                              cursor: isActive ? 'default' : 'pointer',
                              transition: 'background 0.15s ease',
                              outline: isSelected && !isActive ? '2px solid #4a4a4a' : 'none',
                              outlineOffset: '-2px'
                            }}
                          >
                            <td className="id-cell">{id}</td>
                            <td>{source.name}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{source.path}</td>
                            <td>{source.description || '—'}</td>
                            <td>
                              {isActive && (
                                <span style={{ color: '#4ade80', fontSize: '0.875rem', fontWeight: 'bold' }}>
                                  ● Active
                                </span>
                              )}
                              {isSelected && !isActive && (
                                <span style={{ color: '#888', fontSize: '0.75rem' }}>
                                  {id === 'default'
                                    ? '⏎ Enter to switch'
                                    : '⏎ Enter to switch • Del to delete'
                                  }
                                </span>
                              )}
                            </td>
                            <td className="actions">
                              {!isActive && id !== 'default' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteSource(id)
                                  }}
                                  className="btn-delete"
                                >
                                  Del
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default DevInterface
