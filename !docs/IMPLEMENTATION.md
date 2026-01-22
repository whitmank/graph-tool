# Implementation Guide

## Development Roadmap

### Phase 1: Foundation ✓
**Status**: Complete

**What was done**:
- ✓ Initialize Vite React project
- ✓ Install dependencies (d3, sql.js, localforage)
- ✓ Create project structure
- ✓ Write documentation

**Next**: Begin Phase 2

---

## Phase 2: Database Module

**Goal**: Working SQLite database with CRUD operations

### Step 2.1: Database Initialization
Create `src/database/db.js`:

```javascript
import initSqlJs from 'sql.js';
import localforage from 'localforage';

let db = null;

export async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
  });

  const savedData = await localforage.getItem('graphtool_db');

  if (savedData) {
    db = new SQL.Database(savedData);
  } else {
    db = new SQL.Database();
    createSchema();
  }

  return db;
}

function createSchema() {
  db.run(`
    CREATE TABLE nodes (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      url TEXT,
      x REAL,
      y REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE links (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      label TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX idx_edges_source ON links(source_id)`);
  db.run(`CREATE INDEX idx_edges_target ON links(target_id)`);
}

export function getDatabase() {
  return db;
}

export async function saveDatabase() {
  if (db) {
    const data = db.export();
    await localforage.setItem('graphtool_db', data);
  }
}
```

### Step 2.2: CRUD Operations
Create `src/database/queries.js`:

```javascript
import { getDatabase, saveDatabase } from './db';

// Nodes
export function getAllNodes() {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM nodes ORDER BY created_at");
  const result = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    result.push({
      id: row.id,
      label: row.label,
      url: row.url,
      x: row.x,
      y: row.y
    });
  }

  stmt.free();
  return result;
}

export function createNode({ label, url = null }) {
  const db = getDatabase();
  const id = crypto.randomUUID();

  db.run(
    "INSERT INTO nodes (id, label, url) VALUES (?, ?, ?)",
    [id, label, url]
  );

  saveDatabase();
  return id;
}

export function updateNode(id, { label, url, x, y }) {
  const db = getDatabase();
  const updates = [];
  const values = [];

  if (label !== undefined) {
    updates.push("label = ?");
    values.push(label);
  }
  if (url !== undefined) {
    updates.push("url = ?");
    values.push(url);
  }
  if (x !== undefined && y !== undefined) {
    updates.push("x = ?");
    updates.push("y = ?");
    values.push(x, y);
  }

  values.push(id);

  if (updates.length > 0) {
    db.run(`UPDATE nodes SET ${updates.join(", ")} WHERE id = ?`, values);
    saveDatabase();
  }
}

export function deleteNode(id) {
  const db = getDatabase();
  db.run("DELETE FROM nodes WHERE id = ?", [id]);
  saveDatabase();
}

// Edges
export function getAllLinks() {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM links ORDER BY created_at");
  const result = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    result.push({
      id: row.id,
      source: row.source_id,
      target: row.target_id,
      label: row.label
    });
  }

  stmt.free();
  return result;
}

export function createLink({ source_id, target_id, label = null }) {
  const db = getDatabase();
  const id = crypto.randomUUID();

  db.run(
    "INSERT INTO links (id, source_id, target_id, label) VALUES (?, ?, ?, ?)",
    [id, source_id, target_id, label]
  );

  saveDatabase();
  return id;
}

export function deleteLink(id) {
  const db = getDatabase();
  db.run("DELETE FROM links WHERE id = ?", [id]);
  saveDatabase();
}
```

### Step 2.3: Install localforage
```bash
npm install localforage
```

### Step 2.4: Test Database
In `src/main.jsx`, temporarily add:

```javascript
import { initDatabase } from './database/db';
import { createNode, getAllNodes } from './database/queries';

initDatabase().then(() => {
  console.log('Database initialized');

  const id = createNode({ label: 'Test Node', url: 'https://example.com' });
  console.log('Created node:', id);

  const nodes = getAllNodes();
  console.log('All nodes:', nodes);
});
```

**Checkpoint**: Run `npm run dev` and check browser console. You should see the database operations working.

---

## Phase 3: D3 Physics Engine

**Goal**: Force simulation calculating node positions

### Step 3.1: Create Simulation
Create `src/engine/forceSimulation.js`:

```javascript
import * as d3 from 'd3';

export function createSimulation(nodes, links, width, height) {
  const simulation = d3.forceSimulation(nodes)
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

  return simulation;
}
```

### Step 3.2: Simulation Controls
Create `src/engine/simulationControls.js`:

```javascript
export function addNodeToSimulation(simulation, node) {
  const nodes = simulation.nodes();
  nodes.push(node);
  simulation.nodes(nodes);
  simulation.alpha(0.3).restart();
}

export function removeNodeFromSimulation(simulation, nodeId) {
  const nodes = simulation.nodes().filter(n => n.id !== nodeId);
  simulation.nodes(nodes);

  // Also remove associated links
  const linkForce = simulation.force("link");
  const links = linkForce.links().filter(e =>
    e.source.id !== nodeId && e.target.id !== nodeId
  );
  linkForce.links(edges);

  simulation.alpha(0.3).restart();
}

export function addEdgeToSimulation(simulation, link) {
  const linkForce = simulation.force("link");
  const links = linkForce.links();
  links.push(edge);
  linkForce.links(edges);
  simulation.alpha(0.3).restart();
}

export function removeEdgeFromSimulation(simulation, linkId) {
  const linkForce = simulation.force("link");
  const links = linkForce.links().filter(e => e.id !== linkId);
  linkForce.links(edges);
  simulation.alpha(0.3).restart();
}
```

---

## Phase 4: State Management

**Goal**: Global state with React Context

### Step 4.1: Create Reducer
Create `src/store/graphReducer.js`:

```javascript
import {
  getAllNodes, getAllLinks,
  createNode, updateNode, deleteNode,
  createLink, deleteLink
} from '../database/queries';
import {
  addNodeToSimulation, removeNodeFromSimulation,
  addEdgeToSimulation, removeEdgeFromSimulation
} from '../engine/simulationControls';

export const initialState = {
  graph: {
    nodes: [],
    links: []
  },
  ui: {
    selectedNode: null,
    selectedEdge: null
  },
  simulation: null
};

export default function graphReducer(state, action) {
  switch (action.type) {
    case 'SET_SIMULATION':
      return { ...state, simulation: action.payload };

    case 'LOAD_GRAPH':
      const nodes = getAllNodes();
      const links = getAllLinks();
      return {
        ...state,
        graph: { nodes, links }
      };

    case 'ADD_NODE': {
      const id = createNode(action.payload);
      const newNode = { id, ...action.payload, x: 0, y: 0 };

      if (state.simulation) {
        addNodeToSimulation(state.simulation, newNode);
      }

      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: [...state.graph.nodes, newNode]
        }
      };
    }

    case 'DELETE_NODE': {
      deleteNode(action.payload);

      if (state.simulation) {
        removeNodeFromSimulation(state.simulation, action.payload);
      }

      return {
        ...state,
        graph: {
          nodes: state.graph.nodes.filter(n => n.id !== action.payload),
          links: state.graph.edges.filter(e =>
            e.source.id !== action.payload && e.target.id !== action.payload
          )
        },
        ui: {
          ...state.ui,
          selectedNode: state.ui.selectedNode === action.payload ? null : state.ui.selectedNode
        }
      };
    }

    case 'ADD_EDGE': {
      const id = createLink(action.payload);
      const newLink = { id, ...action.payload };

      if (state.simulation) {
        addEdgeToSimulation(state.simulation, newEdge);
      }

      return {
        ...state,
        graph: {
          ...state.graph,
          links: [...state.graph.edges, newEdge]
        }
      };
    }

    case 'SELECT_NODE':
      return {
        ...state,
        ui: { ...state.ui, selectedNode: action.payload }
      };

    case 'UPDATE_POSITIONS':
      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: [...state.simulation.nodes()]
        }
      };

    default:
      return state;
  }
}
```

### Step 4.2: Create Context Provider
Create `src/store/GraphContext.jsx`:

```javascript
import { createContext, useReducer, useEffect } from 'react';
import graphReducer, { initialState } from './graphReducer';
import { initDatabase } from '../database/db';

export const GraphContext = createContext();

export function GraphProvider({ children }) {
  const [state, dispatch] = useReducer(graphReducer, initialState);

  useEffect(() => {
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

## Phase 5: React Rendering Module

**Goal**: Render graph visually with React components

### Step 5.1: GraphCanvas Component
Create `src/components/GraphCanvas.jsx`:

```javascript
import { useContext, useEffect, useRef, useState } from 'react';
import { GraphContext } from '../store/GraphContext';
import { createSimulation } from '../engine/forceSimulation';
import * as d3 from 'd3';
import Node from './Node';
import Link from './Edge';

export default function GraphCanvas() {
  const { state, dispatch } = useContext(GraphContext);
  const svgRef = useRef();
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  // Initialize simulation
  useEffect(() => {
    if (state.graph.nodes.length > 0 && !state.simulation) {
      const sim = createSimulation(
        state.graph.nodes,
        state.graph.edges,
        window.innerWidth,
        window.innerHeight
      );

      sim.on("tick", () => {
        dispatch({ type: 'UPDATE_POSITIONS' });
      });

      dispatch({ type: 'SET_SIMULATION', payload: sim });
    }
  }, [state.graph.nodes.length]);

  // Setup zoom
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

### Step 5.2: Node Component
Create `src/components/Node.jsx`:

```javascript
import { useContext } from 'react';
import { GraphContext } from '../store/GraphContext';
import * as d3 from 'd3';

export default function Node({ node }) {
  const { state, dispatch } = useContext(GraphContext);

  const drag = d3.drag()
    .on("start", () => {
      node.fx = node.x;
      node.fy = node.y;
    })
    .on("drag", (event) => {
      node.fx = event.x;
      node.fy = event.y;
      state.simulation.alpha(0.3).restart();
    })
    .on("end", () => {
      node.fx = null;
      node.fy = null;
    });

  const isSelected = state.ui.selectedNode === node.id;

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      onClick={() => dispatch({ type: 'SELECT_NODE', payload: node.id })}
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

### Step 5.3: Link Component
Create `src/components/Edge.jsx`:

```javascript
export default function Edge({ link }) {
  const source = link.source;
  const target = link.target;

  return (
    <line
      x1={source.x}
      y1={source.y}
      x2={target.x}
      y2={target.y}
      stroke="#718096"
      strokeWidth={2}
    />
  );
}
```

---

## Phase 6: UI Shell Module

### Step 6.1: App Component
Create `src/components/ui/App.jsx`:

```javascript
import { GraphProvider } from '../../store/GraphContext';
import GraphCanvas from '../GraphCanvas';
import Toolbar from './Toolbar';

export default function App() {
  return (
    <GraphProvider>
      <Toolbar />
      <GraphCanvas />
    </GraphProvider>
  );
}
```

### Step 6.2: Toolbar
Create `src/components/ui/Toolbar.jsx`:

```javascript
import { useContext, useState } from 'react';
import { GraphContext } from '../../store/GraphContext';

export default function Toolbar() {
  const { dispatch } = useContext(GraphContext);
  const [label, setLabel] = useState('');

  const handleAddNode = () => {
    if (label.trim()) {
      dispatch({ type: 'ADD_NODE', payload: { label, url: null } });
      setLabel('');
    }
  };

  return (
    <div style={{ padding: '10px', background: '#edf2f7' }}>
      <input
        type="text"
        placeholder="Node label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <button onClick={handleAddNode}>Add Node</button>
    </div>
  );
}
```

### Step 6.3: Update main.jsx
Replace `src/main.jsx`:

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/ui/App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Phase 7: Testing and Polish

### Checkpoint Tasks
- [ ] Add node via toolbar → appears on canvas
- [ ] Drag node → position updates
- [ ] Click node → selection highlights
- [ ] Refresh page → data persists
- [ ] Add multiple nodes → force simulation runs
- [ ] Delete node → removed from graph

### Enhancements
1. Add EdgeForm for creating links between nodes
2. Add NodeDetailPanel for viewing/editing selected node
3. Add ContextMenu for right-click actions
4. Add keyboard shortcuts (Delete, Escape)
5. Add export/import buttons
6. Style with CSS

---

## Common Issues

### Simulation not running
- Check `simulation.on("tick")` is called
- Verify nodes have numeric x, y properties
- Check browser console for D3 errors

### Drag not working
- Ensure d3.drag() is properly attached
- Check event.x, event.y are defined
- Verify simulation.restart() is called

### Data not persisting
- Check IndexedDB in browser DevTools
- Verify saveDatabase() is called after mutations
- Check sql.js WASM loaded correctly

### Performance issues
- Throttle tick updates: `if (tickCount % 2 === 0) dispatch(...)`
- Use React.memo on Node/Link components
- Reduce simulation alpha decay rate
