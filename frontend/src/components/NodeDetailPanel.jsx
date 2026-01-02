import { useState, useEffect, useRef } from 'react'
import { useGraph } from '../store/useGraph'

/**
 * NodeDetailPanel - Displays detailed information about the selected node
 * Positioned on the left side of the graph interface
 * Allows direct inline editing of label and URL fields
 */
export default function NodeDetailPanel() {
  const { state, updateNode } = useGraph()
  const { selectedNode } = state.ui
  const { nodes } = state.graph

  // Local state for inline editing
  const [labelValue, setLabelValue] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const labelRef = useRef(null)
  const urlRef = useRef(null)

  // Find the selected node data
  const node = nodes.find(n => n.id === selectedNode)

  // Update local state when node changes
  useEffect(() => {
    if (node) {
      setLabelValue(node.label)
      setUrlValue(node.url || '')
    }
  }, [selectedNode, node?.label, node?.url])

  const saveLabel = async () => {
    if (!node || !labelValue.trim()) {
      // Revert if empty
      setLabelValue(node?.label || '')
      return
    }

    if (labelValue.trim() !== node.label) {
      try {
        // Update via API
        const response = await fetch(`/api/nodes/${node.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: labelValue.trim() })
        })

        if (!response.ok) {
          throw new Error('Failed to update node')
        }

        const updatedNode = await response.json()

        // Update local state
        updateNode(updatedNode)
      } catch (error) {
        console.error('Failed to update label:', error)
        // Revert on error
        setLabelValue(node.label)
      }
    }
  }

  const saveUrl = async () => {
    if (!node) return

    const trimmedUrl = urlValue.trim()
    const currentUrl = node.url || ''

    if (trimmedUrl !== currentUrl) {
      try {
        // Update via API
        const response = await fetch(`/api/nodes/${node.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmedUrl || undefined })
        })

        if (!response.ok) {
          throw new Error('Failed to update node')
        }

        const updatedNode = await response.json()

        // Update local state
        updateNode(updatedNode)
      } catch (error) {
        console.error('Failed to update URL:', error)
        // Revert on error
        setUrlValue(node.url || '')
      }
    }
  }

  const handleLabelKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      labelRef.current?.blur()
    } else if (e.key === 'Escape') {
      setLabelValue(node?.label || '')
      labelRef.current?.blur()
    }
  }

  const handleUrlKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      urlRef.current?.blur()
    } else if (e.key === 'Escape') {
      setUrlValue(node?.url || '')
      urlRef.current?.blur()
    }
  }

  if (!node) {
    return (
      <div className="node-detail-panel">
        <div className="panel-empty">
          <p>No node selected</p>
          <p className="panel-hint">Click a node to view details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="node-detail-panel">
      <div className="panel-header">
        <h2>Node Details</h2>
      </div>

      <div className="panel-content">
        {/* Label Field - Inline Editable */}
        <div className="detail-group">
          <label>Label</label>
          <input
            ref={labelRef}
            type="text"
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={handleLabelKeyDown}
            className="detail-input-inline"
            placeholder="Node label"
          />
        </div>

        {/* URL Field - Inline Editable */}
        <div className="detail-group">
          <label>URL</label>
          <input
            ref={urlRef}
            type="text"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onBlur={saveUrl}
            onKeyDown={handleUrlKeyDown}
            className="detail-input-inline"
            placeholder="https://example.com"
          />
        </div>

        {/* Read-only fields */}
        {node.created_at && (
          <>
            <div className="detail-divider"></div>
            <div className="detail-group">
              <label>Created</label>
              <div className="detail-value detail-id">
                {new Date(node.created_at).toLocaleDateString()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
