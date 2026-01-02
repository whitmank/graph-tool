import GraphCanvas from './components/GraphCanvas'
import NodeDetailPanel from './components/NodeDetailPanel'

function App() {
  return (
    <>
      <div className="frame"></div>
      <main>
        <NodeDetailPanel />
        <div className="graph-container">
          <GraphCanvas />
        </div>
      </main>
    </>
  )
}

export default App
