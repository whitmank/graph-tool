# System Modules

## Modular Architecture Philosophy

GraphTool is designed with **clear separation of concerns** across five independent modules (A-E). Each module:
- Has a well-defined external interface
- Can be developed and tested independently
- Can be replaced with alternative implementations
- Minimizes dependencies on other modules

**Non-linear Development**: Modules can be worked on in any order. Mock data and stubs enable parallel development.

## Module Organization

```
src/
├── database/           # Module A: Persistence layer (standalone)
│   ├── db.js
│   ├── schema.js
│   └── queries.js
├── engine/             # Module B: Physics computation (standalone)
│   ├── forceSimulation.js
│   └── simulationControls.js
├── components/         # Module C: React visualization (depends on D)
│   ├── GraphCanvas.jsx
│   ├── Node.jsx
│   ├── Edge.jsx
│   └── NodeDetailPanel.jsx
├── components/ui/      # Module E: UI shell (depends on D)
│   ├── App.jsx
│   ├── Toolbar.jsx
│   ├── ContextMenu.jsx
│   ├── NodeForm.jsx
│   └── EdgeForm.jsx
├── store/              # Module D: State orchestration (integrates A, B, C)
│   ├── GraphContext.jsx
│   └── graphReducer.js
├── utils/              # Helper utilities (support all modules)
│   ├── idGenerator.js
│   └── exportImport.js
└── styles/             # CSS
    ├── global.css
    └── graph.css
```

**Module Dependency Map**:
```
A (Database) ←──────────┐
                         │
B (Engine) ←────────┐   │
                     │   │
                     ↓   ↓
                  D (State) ← Orchestration layer
                     ↓   ↓
                     │   │
C (Rendering) ←─────┘   │
                         │
E (UI Shell) ←───────────┘
```

**Key Insight**: Modules A and B are completely standalone. Module D integrates them. Modules C and E consume state from D.

---

## Module A: Database (Persistence Layer)

**Module Independence**: ⭐⭐⭐⭐⭐ Fully standalone - no dependencies on other modules

**Can be developed with**: Mock data, standalone tests, browser console

**Alternative implementations**: Replace IndexedDB with localStorage, remote API, or file system

---

### `database/db.js`
**Purpose**: Initialize sql.js and manage database connection

**Exports**:
```javascript
initDatabase() → Promise<Database>
getDatabase() → Database
saveDatabase() → Promise<void>
```

**Implementation**:
- Load sql.js WASM module
- Check IndexedDB for existing database
- Create new DB if none exists
- Auto-save on mutations (debounced)

---

### `database/schema.js`
**Purpose**: Define database schema

**Exports**:
```javascript
createSchema(db) → void
```

**Implementation**:
- CREATE TABLE statements for nodes and edges
- CREATE INDEX for performance
- Initial constraints setup

---

### `database/queries.js`
**Purpose**: CRUD operations for nodes and edges

**Exports**:
```javascript
// Nodes
getAllNodes() → Node[]
getNode(id) → Node | null
createNode({label, url}) → string (id)
updateNode(id, {label, url, x, y}) → void
deleteNode(id) → void

// Edges
getAllEdges() → Edge[]
getEdge(id) → Edge | null
createEdge({source_id, target_id, label}) → string (id)
updateEdge(id, {label}) → void
deleteEdge(id) → void

// Helpers
getNodeEdges(nodeId) → Edge[]  // All edges connected to node
```

**Types**:
```javascript
// Node
{
  id: string,
  label: string,
  url: string | null,
  x: number | null,
  y: number | null
}

// Edge
{
  id: string,
  source: string,     // node id
  target: string,     // node id
  label: string | null
}
```

---

## Module B: Physics Engine (Computation Layer)

**Module Independence**: ⭐⭐⭐⭐⭐ Fully standalone - no dependencies on other modules

**Can be developed with**: Hardcoded node arrays, visualization in vanilla JS or D3

**Alternative implementations**: Replace D3 with Matter.js, custom physics, or static layouts

---

### `engine/forceSimulation.js`
**Purpose**: Configure and run D3 force simulation

**Exports**:
```javascript
createSimulation(nodes, edges, width, height) → Simulation
```

**Implementation**:
```javascript
import * as d3 from 'd3';

export function createSimulation(nodes, edges, width, height) {
  return d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges)
      .id(d => d.id)
      .distance(100)
    )
    .force("charge", d3.forceManyBody()
      .strength(-300)
    )
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide()
      .radius(30)
    );
}
```

**Force Parameters** (tunable):
- `link.distance`: Edge length (default 100)
- `charge.strength`: Node repulsion (default -300)
- `collide.radius`: Collision buffer (default 30)

---

### `engine/simulationControls.js`
**Purpose**: Manage simulation lifecycle and dynamic updates

**Exports**:
```javascript
addNode(simulation, node) → void
removeNode(simulation, nodeId) → void
addEdge(simulation, edge) → void
removeEdge(simulation, edgeId) → void
reheatSimulation(simulation) → void
```

**Implementation**:
```javascript
export function addNode(simulation, node) {
  const nodes = simulation.nodes();
  nodes.push(node);
  simulation.nodes(nodes);
  simulation.alpha(0.3).restart();
}

export function removeNode(simulation, nodeId) {
  const nodes = simulation.nodes().filter(n => n.id !== nodeId);
  simulation.nodes(nodes);
  simulation.alpha(0.3).restart();
}

export function reheatSimulation(simulation) {
  simulation.alpha(0.3).restart();
}
```

---

## Module C: React Rendering (Visualization Layer)

**Module Independence**: ⭐⭐⭐ Moderate - requires Module D (state), can mock simulation data

**Can be developed with**: Mock state provider, hardcoded node positions

**Alternative implementations**: Replace SVG with Canvas, WebGL, or HTML elements

---

### `components/GraphCanvas.jsx`
**Purpose**: Main SVG container with zoom/pan

**Props**: None (uses context)

**State**:
```javascript
const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
```

**Implementation**:
```javascript
import { useContext, useEffect, useRef } from 'react';
import { GraphContext } from '../store/GraphContext';
import * as d3 from 'd3';
import Node from './Node';
import Edge from './Edge';

export default function GraphCanvas() {
  const { state } = useContext(GraphContext);
  const svgRef = useRef();

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });

    svg.call(zoom);
  }, []);

  return (
    <svg ref={svgRef} width="100%" height="100vh">
      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {state.graph.edges.map(edge => (
          <Edge key={edge.id} edge={edge} />
        ))}
        {state.graph.nodes.map(node => (
          <Node key={node.id} node={node} />
        ))}
      </g>
    </svg>
  );
}
```

**Features**:
- d3-zoom for pan/zoom
- Renders edges before nodes (z-index)
- Transforms entire graph group

---

### `components/Node.jsx`
**Purpose**: Render individual node as SVG circle

**Props**:
```javascript
{
  node: {id, label, url, x, y}
}
```

**Implementation**:
```javascript
import { useContext } from 'react';
import { GraphContext } from '../store/GraphContext';
import * as d3 from 'd3';

export default function Node({ node }) {
  const { state, dispatch } = useContext(GraphContext);

  const handleDragStart = (event) => {
    node.fx = node.x;
    node.fy = node.y;
  };

  const handleDrag = (event) => {
    node.fx = event.x;
    node.fy = event.y;
    state.simulation.alpha(0.3).restart();
  };

  const handleDragEnd = () => {
    node.fx = null;
    node.fy = null;
  };

  const handleClick = () => {
    dispatch({ type: 'SELECT_NODE', payload: node.id });
  };

  const isSelected = state.ui.selectedNode === node.id;

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      onMouseDown={handleDragStart}
      onMouseMove={handleDrag}
      onMouseUp={handleDragEnd}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      <circle
        r={15}
        fill={isSelected ? "#4299e1" : "#cbd5e0"}
        stroke="#2d3748"
        strokeWidth={2}
      />
      <text
        y={-20}
        textAnchor="middle"
        fontSize={12}
        fill="#2d3748"
      >
        {node.label}
      </text>
    </g>
  );
}
```

**Features**:
- Drag behavior with position fixing
- Selection highlighting
- Label above node

---

### `components/Edge.jsx`
**Purpose**: Render edge as SVG line

**Props**:
```javascript
{
  edge: {id, source, target, label}
}
```

**Implementation**:
```javascript
export default function Edge({ edge }) {
  const { state } = useContext(GraphContext);

  // D3 replaces source/target strings with node objects
  const source = edge.source;
  const target = edge.target;

  return (
    <g>
      <line
        x1={source.x}
        y1={source.y}
        x2={target.x}
        y2={target.y}
        stroke="#718096"
        strokeWidth={2}
      />
      {edge.label && (
        <text
          x={(source.x + target.x) / 2}
          y={(source.y + target.y) / 2}
          textAnchor="middle"
          fontSize={10}
          fill="#4a5568"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}
```

---

### `components/NodeDetailPanel.jsx`
**Purpose**: Display selected node details

**Props**: None (uses context)

**Implementation**:
```javascript
export default function NodeDetailPanel() {
  const { state, dispatch } = useContext(GraphContext);

  if (!state.ui.selectedNode) return null;

  const node = state.graph.nodes.find(n => n.id === state.ui.selectedNode);

  return (
    <div className="detail-panel">
      <h3>{node.label}</h3>
      {node.url && <a href={node.url} target="_blank">Visit Link</a>}
      <button onClick={() => dispatch({ type: 'DELETE_NODE', payload: node.id })}>
        Delete
      </button>
    </div>
  );
}
```

---

## Module E: UI Shell (Interaction Layer)

**Module Independence**: ⭐⭐⭐⭐ High - only requires Module D (state), can use mock dispatch

**Can be developed with**: Mock context provider, console.log for actions

**Alternative implementations**: Replace forms with CLI, voice commands, or different UI framework

---

### `components/ui/App.jsx`
**Purpose**: Root component and layout

**Implementation**:
```javascript
import { GraphProvider } from '../../store/GraphContext';
import GraphCanvas from '../GraphCanvas';
import Toolbar from './Toolbar';
import NodeDetailPanel from '../NodeDetailPanel';

export default function App() {
  return (
    <GraphProvider>
      <div className="app">
        <Toolbar />
        <GraphCanvas />
        <NodeDetailPanel />
      </div>
    </GraphProvider>
  );
}
```

---

### `components/ui/Toolbar.jsx`
**Purpose**: Top control bar

**Implementation**:
```javascript
export default function Toolbar() {
  const { dispatch } = useContext(GraphContext);
  const [showNodeForm, setShowNodeForm] = useState(false);

  return (
    <div className="toolbar">
      <button onClick={() => setShowNodeForm(true)}>Add Node</button>
      <button onClick={() => dispatch({ type: 'EXPORT_DB' })}>Export</button>

      {showNodeForm && <NodeForm onClose={() => setShowNodeForm(false)} />}
    </div>
  );
}
```

---

### `components/ui/NodeForm.jsx`
**Purpose**: Modal for creating/editing nodes

**Props**:
```javascript
{
  onClose: () => void,
  node?: Node  // If editing existing node
}
```

**Implementation**:
```javascript
export default function NodeForm({ onClose, node }) {
  const { dispatch } = useContext(GraphContext);
  const [label, setLabel] = useState(node?.label || '');
  const [url, setUrl] = useState(node?.url || '');

  const handleSubmit = (e) => {
    e.preventDefault();

    if (node) {
      dispatch({ type: 'UPDATE_NODE', payload: { id: node.id, label, url } });
    } else {
      dispatch({ type: 'ADD_NODE', payload: { label, url } });
    }

    onClose();
  };

  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <input
          type="url"
          placeholder="URL (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="submit">Save</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
}
```

---

### `components/ui/EdgeForm.jsx`
**Purpose**: Modal for creating edges

**Props**:
```javascript
{
  onClose: () => void,
  sourceNode?: Node  // Pre-selected source
}
```

**Implementation**: Similar to NodeForm with dropdowns for source/target selection

---

### `components/ui/ContextMenu.jsx`
**Purpose**: Right-click menu

**Props**:
```javascript
{
  x: number,
  y: number,
  target: Node | Edge | null
}
```

**Implementation**: Position absolute div at click coordinates with context-specific actions

---

## Module D: State Management (Orchestration Layer)

**Module Independence**: ⭐⭐ Low - integrates Modules A, B, C, E (this is the glue)

**Can be developed with**: Mock implementations of database and simulation

**Alternative implementations**: Replace Context+Reducer with Redux, Zustand, MobX, or Jotai

**Key Role**: This module is the integration point that coordinates all other modules. It's intentionally coupled.

---

### `store/GraphContext.jsx`
**Purpose**: Provide global state via Context API

**Exports**:
```javascript
GraphProvider  // Component
GraphContext   // Context object
```

**Implementation**:
```javascript
import { createContext, useReducer, useEffect } from 'react';
import graphReducer, { initialState } from './graphReducer';
import { initDatabase } from '../database/db';

export const GraphContext = createContext();

export function GraphProvider({ children }) {
  const [state, dispatch] = useReducer(graphReducer, initialState);

  useEffect(() => {
    // Initialize DB and load data on mount
    initDatabase().then(() => {
      dispatch({ type: 'LOAD_GRAPH' });
    });
  }, []);

  return (
    <GraphContext.Provider value={{ state, dispatch }}>
      {children}
    </GraphContext.Provider>
  );
}
```

---

### `store/graphReducer.js`
**Purpose**: Handle state mutations

**State Shape**:
```javascript
{
  graph: { nodes: [], edges: [] },
  ui: { selectedNode: null, selectedEdge: null },
  simulation: null
}
```

**Actions**:
- `LOAD_GRAPH` - Load from database
- `ADD_NODE` - Create node in DB and simulation
- `UPDATE_NODE` - Update label/url
- `DELETE_NODE` - Remove from DB and simulation
- `ADD_EDGE` - Create edge
- `DELETE_EDGE` - Remove edge
- `SELECT_NODE` - Update selectedNode
- `UPDATE_POSITIONS` - Simulation tick update

**Example Reducer**:
```javascript
case 'ADD_NODE':
  const id = createNode(action.payload);
  const newNode = { id, ...action.payload, x: 0, y: 0 };
  addNode(state.simulation, newNode);
  return {
    ...state,
    graph: {
      ...state.graph,
      nodes: [...state.graph.nodes, newNode]
    }
  };
```

---

## Utilities (Support Functions)

**Not a core module** - Helper functions used across modules

**Module Independence**: ⭐⭐⭐⭐⭐ Fully standalone - pure functions

### `utils/idGenerator.js`
```javascript
export function generateId() {
  return crypto.randomUUID();
}
```

### `utils/exportImport.js`
```javascript
export function exportDatabase(db) { /* ... */ }
export function importDatabase(file) { /* ... */ }
```
