import { Link as RouterLink } from 'react-router-dom'
import './App.css'
import { useGraph } from './store/useGraph'
import GraphCanvas from './components/GraphCanvas'

function App() {
  const { state } = useGraph()
  const { nodes, links } = state.graph

  return (
    <div className="app">
      <header className="header">
        <h1>GraphTool</h1>
        <div className="status">
          <span className="count">{nodes.length} nodes, {links.length} links</span>
          <RouterLink to="/dev" className="dev-link">Developer Interface →</RouterLink>
        </div>
      </header>

      <main className="main" style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
        <GraphCanvas />
        {state.ui.error && (
          <div className="error-message" style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '6px',
            border: '1px solid #fecaca'
          }}>
            Error: {state.ui.error}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
