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

**Module Independence**: ⭐⭐⭐⭐ High - Backend is standalone, frontend consumes via HTTP

**Can be developed with**: cURL for testing API, Postman, or Thunder Client

**Alternative implementations**: Replace SurrealDB with PostgreSQL, MongoDB, MySQL, or any database - frontend API contract remains unchanged

**Architecture**: Client-Server (Backend: Node.js + SurrealDB, Frontend: REST API consumer)

---

### `db-service.js` (Backend)
**Purpose**: SurrealDB client wrapper with CRUD operations

**Location**: Root directory (`/db-service.js`)

**Exports**:
```javascript
// Connection
connect() → Promise<boolean>
disconnect() → Promise<void>

// Node operations
getAllNodes() → Promise<Node[]>
getNode(id) → Promise<Node | null>
createNode(data) → Promise<Node>
updateNode(id, data) → Promise<Node>
deleteNode(id) → Promise<{success, id}>

// Link operations
getAllLinks() → Promise<Link[]>
getLink(id) → Promise<Link | null>
createLink(data) → Promise<Link>
updateLink(id, data) → Promise<Link>
deleteLink(id) → Promise<{success, id}>
getNodeLinks(nodeId) → Promise<Link[]>
```

**Implementation**:
- Connect to SurrealDB via surrealdb.js client library
- Execute SurrealQL queries
- Handle document-based data model
- Implement cascade deletes at application level

---

### `server.js` (Backend)
**Purpose**: Express API server and SurrealDB process manager

**Location**: Root directory (`/server.js`)

**Responsibilities**:
- Spawn and manage SurrealDB child process
- Expose REST API endpoints (`/api/nodes`, `/api/links`)
- Serve built Vite frontend (from `/dist`)
- Handle graceful shutdown

**API Endpoints**:
```
Health & Status:
  GET  /health
  GET  /api/status

Nodes:
  GET    /api/nodes
  GET    /api/nodes/:id
  POST   /api/nodes
  PUT    /api/nodes/:id
  DELETE /api/nodes/:id

Links:
  GET    /api/links
  GET    /api/links/:id
  POST   /api/links
  PUT    /api/links/:id
  DELETE /api/links/:id
  GET    /api/nodes/:id/links

Data Sources:
  GET    /api/data-sources
  GET    /api/data-sources/current
  POST   /api/data-sources
  PUT    /api/data-sources/switch/:id
  DELETE /api/data-sources/:id
```

**Startup Process**:
1. Ensure directory structure (`files/nodes/`, `files/links/`)
2. Start SurrealDB as child process (ephemeral, in-memory)
3. Connect db-service to SurrealDB
4. Load JSON files and populate SurrealDB cache
5. Start file watchers (chokidar)
6. Start Express server on port 3000 with WebSocket support
7. Serve frontend and API

---

### `file-service.js` (Backend)
**Purpose**: File I/O operations, atomic writes, and file watching

**Location**: Root directory (`/file-service.js`)

**Exports**:
```javascript
// Initialization
setDbService(service) → void
ensureDirectories() → Promise<void>

// File operations
saveNode(node) → Promise<void>
saveLink(link) → Promise<void>
deleteNodeFile(id) → Promise<void>
deleteLinkFile(id) → Promise<void>

// Startup loading
loadAllFiles() → Promise<{nodes, links, errors}>

// File watchers
startWatchers() → void
stopWatchers() → void
reloadWatchers() → Promise<void>

// Data source management
updateDataSourcePaths(newSourcePath) → void
getCurrentPaths() → {filesDir, nodesDir, linksDir}
```

**Key Features**:
- **Atomic writes**: Write to `.tmp` file, then rename (prevents corruption)
- **File watching**: Detect external file changes with chokidar
- **Loop prevention**: Track own writes to prevent reload loops
- **Error handling**: Graceful degradation on corrupt files
- **Cascade deletes**: Delete all link files when node is deleted

**File naming convention**: `{table}_{id-suffix}.json`
- Example: `nodes:abc123` → `node_abc123.json`
- Example: `links:xyz789` → `link_xyz789.json`

---

### `data-source-service.js` (Backend)
**Purpose**: Multi-source data management with hot reload

**Location**: Root directory (`/data-source-service.js`)

**Exports**:
```javascript
// Configuration
getConfig() → Promise<{current, sources}>
saveConfig(config) → Promise<void>

// Source operations
getAllSources() → Promise<SourceMap>
getCurrentSource() → Promise<{id, name, path, description}>
addSource(id, sourceData) → Promise<Source>
removeSource(id) → Promise<void>

// Hot reload
switchSource(newSourceId) → Promise<Source>

// Validation
validateSourcePath(sourcePath) → Promise<{valid, absolutePath, nodesDir, linksDir, error?}>
```

**Configuration file**: `data-sources.json`
```json
{
  "current": "default",
  "sources": {
    "default": {
      "name": "Default (Project Files)",
      "path": "./files",
      "description": "Default data storage in project folder"
    }
  }
}
```

**Hot reload process**:
1. Validate new source path
2. Stop file watchers
3. Clear SurrealDB cache
4. Update file-service paths
5. Load files from new source
6. Restart file watchers
7. Broadcast WebSocket update

---

### Frontend API Client (to be implemented)
**Purpose**: HTTP client wrapper for REST API calls

**Location**: `src/api/client.js` (frontend)

**Interface**:
```javascript
// Will be consumed by Module D (State Management)
export async function fetchAllNodes() {
  const response = await fetch('/api/nodes');
  return response.json();
}

export async function createNode(data) {
  const response = await fetch('/api/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}

// ... more API methods
```

---

### `database/schema.js`
**Purpose**: Define database schema

**Exports**:
```javascript
createSchema(db) → void
```

**Implementation**:
- CREATE TABLE statements for nodes and links
- CREATE INDEX for performance
- Initial constraints setup

---

### `database/queries.js`
**Purpose**: CRUD operations for nodes and links

**Exports**:
```javascript
// Nodes
getAllNodes() → Node[]
getNode(id) → Node | null
createNode({label, url}) → string (id)
updateNode(id, {label, url, x, y}) → void
deleteNode(id) → void

// Edges
getAllLinks() → Edge[]
getLink(id) → Link | null
createLink({source_id, target_id, label}) → string (id)
updateLink(id, {label}) → void
deleteLink(id) → void

// Helpers
getNodeLinks(nodeId) → Edge[]  // All links connected to node
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
createSimulation(nodes, links, width, height) → Simulation
```

**Implementation**:
```javascript
import * as d3 from 'd3';

export function createSimulation(nodes, links, width, height) {
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
- `link.distance`: Link length (default 100)
- `charge.strength`: Node repulsion (default -300)
- `collide.radius`: Collision buffer (default 30)

---

### `engine/simulationControls.js`
**Purpose**: Manage simulation lifecycle and dynamic updates

**Exports**:
```javascript
addNode(simulation, node) → void
removeNode(simulation, nodeId) → void
addEdge(simulation, link) → void
removeEdge(simulation, linkId) → void
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
import Link from './Edge';

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
          <Link key={edge.id} link={edge} />
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
- Renders links before nodes (z-index)
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
**Purpose**: Render link as SVG line

**Props**:
```javascript
{
  link: {id, source, target, label}
}
```

**Implementation**:
```javascript
export default function Edge({ link }) {
  const { state } = useContext(GraphContext);

  // D3 replaces source/target strings with node objects
  const source = link.source;
  const target = link.target;

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
**Purpose**: Modal for creating links

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
  target: Node | Link | null
}
```

**Implementation**: Position absolute div at click coordinates with context-specific actions

---

### `src/DevInterface.jsx`
**Purpose**: Developer CRUD interface for nodes, links, and data sources

**Route**: `/dev` (accessed via React Router)

**Features**:
- **Nodes view**: Create, read, update, delete nodes
- **Links view**: Create, read, delete links with source/target selection
- **Data sources view**: Manage multiple data sources, switch between them
- **Real-time updates**: WebSocket integration for live data sync
- **Keyboard navigation**: Arrow keys for data source selection
- **Form validation**: Required fields, error handling

**State**:
```javascript
const [nodes, setNodes] = useState([]);
const [links, setLinks] = useState([]);
const [dataSources, setDataSources] = useState([]);
const [view, setView] = useState('nodes'); // 'nodes', 'links', or 'sources'
const [nodeFormData, setNodeFormData] = useState({label: '', url: ''});
const [linkFormData, setLinkFormData] = useState({source_id: '', target_id: '', label: ''});
```

**API Integration**:
- Fetches from `/api/nodes`, `/api/links`, `/api/data-sources`
- WebSocket connection for real-time updates
- Handles cascade deletes (deleting node deletes connected links)
- Reloads data after data source switch

**UI Components**:
- View toggle buttons (Nodes/Links/Sources)
- CRUD forms for each entity type
- Data tables with action buttons
- Status indicators and error messages

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
  graph: { nodes: [], links: [] },
  ui: { selectedNode: null, selectedEdge: null },
  simulation: null
}
```

**Actions**:
- `LOAD_GRAPH` - Load from database
- `ADD_NODE` - Create node in DB and simulation
- `UPDATE_NODE` - Update label/url
- `DELETE_NODE` - Remove from DB and simulation
- `ADD_EDGE` - Create link
- `DELETE_EDGE` - Remove link
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
