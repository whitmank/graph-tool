# Architecture

## System Overview
GraphTool uses a **client-server architecture** with clear separation of concerns. The backend manages data persistence with SurrealDB, while the frontend handles visualization and user interaction.

## Data Flow

```
┌──────────────── CLIENT (Browser) ────────────────┐
│                                                    │
│  ┌─────────────┐                                 │
│  │   User UI   │ ← User interactions              │
│  └──────┬──────┘                                 │
│         ↓                                         │
│  ┌─────────────┐                                 │
│  │React State  │ ← Dispatch actions               │
│  │  (Context)  │                                 │
│  └──────┬──────┘                                 │
│         ↓                                         │
│      ┌──┴───┐                                    │
│      ↓      ↓                                     │
│  ┌────────┐ ┌──────────┐                        │
│  │API     │ │D3 Engine │ ← Local physics         │
│  │Client  │ │Simulation│                         │
│  └────┬───┘ └─────┬────┘                        │
│       │           ↓                               │
│       │     ┌──────────┐                         │
│       │     │Position  │                         │
│       │     │Updates   │                         │
│       │     └─────┬────┘                         │
│       │           ↓                               │
│       │     ┌──────────┐                         │
│       │     │React     │ ← Re-render              │
│       │     │Render    │                         │
│       │     └──────────┘                         │
│       │                                           │
└───────┼───────────────────────────────────────────┘
        │
        │ HTTP REST API
        │ (JSON)
        ↓
┌──────────────── SERVER (Node.js) ────────────────┐
│                                                    │
│  ┌─────────────┐                                 │
│  │  Express    │ ← API Routes + WebSocket         │
│  │  Server     │   /api/nodes, /api/links         │
│  └──────┬──────┘   /api/data-sources             │
│         ↓                                         │
│  ┌─────────────┐                                 │
│  │ db-service  │ ← CRUD operations                │
│  └──────┬──────┘                                 │
│         ↓      ↘                                  │
│  ┌─────────────┐ ┌──────────────┐               │
│  │ SurrealDB   │ │ file-service │ ← File I/O    │
│  │ (ephemeral  │ │ (persistence)│   Watchers     │
│  │  cache)     │ └──────┬───────┘               │
│  └─────────────┘        ↓                        │
│                   ┌──────────────┐               │
│                   │  JSON Files  │ ← Source of   │
│                   │files/nodes/  │   Truth       │
│                   │files/links/  │               │
│                   └──────────────┘               │
│                                                    │
└────────────────────────────────────────────────────┘
```

## Core Principle: React for Rendering, D3 for Math

### The Problem
Both React and D3 want to control the DOM:
- React uses virtual DOM and declarative rendering
- D3 traditionally uses imperative DOM manipulation

### The Solution
**Separation of Responsibilities:**
- **D3**: Calculates physics (force simulation, positions)
- **React**: Renders UI based on those calculations
- **D3 never touches the DOM** - only provides data

## Module Breakdown

The system is organized into **five independent modules** (A-E) with clear separation of concerns. Each module can be developed, tested, and modified independently as long as its external interface contract is maintained.

### Module A: Database (Persistence Layer)
**Location**: `/db-service.js` (backend) + HTTP API

**Responsibility**: Persistent storage of graph structure via SurrealDB

**Dependencies**: SurrealDB server process, Express.js

**Key Files**:
- `server.js` - Express API server, manages SurrealDB process
- `db-service.js` - SurrealDB client wrapper with CRUD operations
- `data/` - File-based SurrealDB storage directory

**External Interface**:
```javascript
// Backend (db-service.js):
getAllNodes() → [{id, label, url, x, y}, ...]
createNode({label, url}) → nodeId
deleteNode(id) → void

// Frontend consumes via HTTP REST API:
GET    /api/nodes
POST   /api/nodes
PUT    /api/nodes/:id
DELETE /api/nodes/:id
// See DATABASE.md for complete API
```

**Module Independence**: Backend is standalone. Can replace SurrealDB with PostgreSQL, MongoDB, or any database without changing frontend API contract.

---

### Module B: Physics Engine (Computation Layer)
**Location**: `/src/engine/`

**Responsibility**: Calculate node positions using D3 force simulation

**Dependencies**: None (standalone, requires D3.js library)

**Key Files**:
- `forceSimulation.js` - D3 force configuration
- `simulationControls.js` - Dynamic node/edge management

**External Interface**:
```javascript
// Consumed by: Module C (Rendering), Module D (State)
createSimulation(nodes, links, width, height) → Simulation
addNode(simulation, node) → void
removeNode(simulation, nodeId) → void
```

**Forces Applied**:
- `forceLink()` - Spring forces between connected nodes
- `forceManyBody()` - Repulsion between all nodes
- `forceCenter()` - Gravity toward canvas center
- `forceCollide()` - Collision detection

**Module Independence**: Can swap D3 force simulation for alternative physics engines (Matter.js, custom algorithms) without affecting other modules.

---

### Module C: React Rendering (Visualization Layer)
**Location**: `/src/components/`

**Responsibility**: Render SVG elements based on simulation data

**Dependencies**: Consumes Module B (simulation positions), Module D (state)

**Key Files**:
- `GraphCanvas.jsx` - SVG container, zoom/pan
- `Node.jsx` - Circle at (x, y) position
- `Edge.jsx` - Line between source and target
- `NodeDetailPanel.jsx` - Selected node info

**External Interface**:
```javascript
// Consumes: state.graph.nodes, state.graph.edges
// Renders: SVG elements at node.x, node.y positions
<GraphCanvas /> // Root visualization component
```

**Module Independence**: Can replace SVG rendering with Canvas API, WebGL, or HTML elements. Can work with mock data independently of other modules.

---

### Module D: State Management (Orchestration Layer)
**Location**: `/src/store/`

**Responsibility**: Coordinate between modules and manage application state

**Dependencies**: Orchestrates Modules A, B, C (acts as the integration point)

**Key Files**:
- `GraphContext.jsx` - Context provider
- `graphReducer.js` - State mutations and action handlers

**External Interface**:
```javascript
// Provides to: Module C, Module E
const { state, dispatch } = useContext(GraphContext);

// State shape
{
  graph: { nodes: [], links: [] },
  ui: { selectedNode: null, selectedEdge: null },
  simulation: SimulationRef
}
```

**Module Independence**: Can replace Context+Reducer with Redux, Zustand, Jotai, or any state library. Acts as the adapter between modules.

---

### Module E: UI Shell (Interaction Layer)
**Location**: `/src/components/ui/`

**Responsibility**: User controls, forms, and interactions

**Dependencies**: Consumes Module D (state management)

**Key Files**:
- `App.jsx` - Root layout component
- `Toolbar.jsx` - Add node/edge buttons
- `NodeForm.jsx` - Create/edit modal
- `EdgeForm.jsx` - Create link modal
- `ContextMenu.jsx` - Right-click actions

**External Interface**:
```javascript
// Dispatches to: Module D (state)
dispatch({ type: 'ADD_NODE', payload: { label, url } })
```

**Module Independence**: Can redesign entire UI without touching Modules A-D. Can replace React with Vue, Svelte, or vanilla JS as long as it dispatches to state.

## State Management

**Strategy**: React Context + useReducer

**Why not Redux/Zustand?**
- Minimal dependencies
- Graph state is simple (nodes array, links array)
- No complex async logic

**State Structure**:
```javascript
{
  graph: {
    nodes: [{id, label, url, x, y}, ...],
    links: [{id, source, target, label}, ...]
  },
  ui: {
    selectedNode: id | null,
    selectedEdge: id | null,
    isAddingEdge: false,
    linkSourceNode: id | null
  },
  simulation: d3.forceSimulation() // Reference to D3 instance
}
```

**Action Flow Example**:
```javascript
// User clicks "Add Node"
dispatch({ type: 'ADD_NODE', payload: { label: 'New Node', url: '' } })

// Reducer handles:
1. Generate ID
2. Call createNode() → write to DB
3. Call simulation.add() → add to physics
4. Update state.graph.nodes → trigger re-render
```

## Integration Pattern: D3 + React

### Setup Phase (once)
```javascript
// GraphCanvas.jsx
useEffect(() => {
  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d => d.id))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width/2, height/2));

  setSimulation(sim);

  return () => sim.stop();
}, []);
```

### Tick Phase (every frame)
```javascript
useEffect(() => {
  if (!simulation) return;

  simulation.on("tick", () => {
    // Update React state with new positions
    setNodes([...simulation.nodes()]);
  });
}, [simulation]);
```

### Interaction Phase (on demand)
```javascript
// When user drags a node
function handleDrag(node) {
  node.fx = event.x;  // Fix position during drag
  node.fy = event.y;
  simulation.alpha(0.3).restart();  // Reheat simulation
}

function handleDragEnd(node) {
  node.fx = null;  // Release fixed position
  node.fy = null;
}
```

## Persistence Strategy

### File-Based Architecture

**Primary Storage**: JSON files (source of truth)
- **Location**: `files/nodes/` and `files/links/` directories
- **Format**: One JSON file per node/link
- **Benefits**: Human-readable, version-controllable, directly editable

**Cache Layer**: SurrealDB 2.x (ephemeral, in-memory)
- **Purpose**: Fast querying, relationship traversal
- **Lifecycle**: Populated from files on startup, cleared on shutdown
- **No persistence**: Database is rebuild from files each time

### Data Flow

**On Server Startup**:
1. Load all JSON files from `files/` directory
2. Validate and parse JSON
3. Populate SurrealDB cache
4. Start file watchers (chokidar)
5. Start WebSocket for real-time updates

**On Client Request (Create/Update)**:
1. Client → HTTP POST/PUT → Express server
2. Express → db-service → SurrealDB (fast write)
3. db-service → file-service → JSON file (durable write)
4. file-service → WebSocket broadcast (all clients notified)

**On External File Change** (user edits file manually):
1. File watcher detects change
2. Update SurrealDB cache
3. WebSocket broadcast to all clients
4. Clients reload data from API

**Load on Mount**:
```javascript
// App.jsx
useEffect(() => {
  fetch('/api/nodes')
    .then(res => res.json())
    .then(nodes => {
      dispatch({ type: 'LOAD_GRAPH', payload: nodes });
    });

  // WebSocket for real-time updates
  const ws = new WebSocket('ws://localhost:3000');
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'node') loadNodes();
    if (message.type === 'link') loadLinks();
  };
}, []);
```

### Data Source Management

**Multi-Source Support**: Switch between different data directories without server restart
- Default: `./files/`
- External: e.g., `/Volumes/External/graphtool-data/`
- Configured in `data-sources.json`

**Hot Reload**: Switching sources clears cache, loads new files, restarts watchers

See [DATABASE.md](DATABASE.md) for detailed persistence architecture and API reference.

## Performance Considerations

1. **React Rendering**:
   - Use `React.memo` for Node/Link components
   - Stable keys (node.id) prevent unnecessary re-renders
   - Consider throttling tick updates for large graphs (>500 nodes)

2. **Simulation Performance**:
   - Adjust `alphaDecay` to balance settling speed vs frame rate
   - Use `alphaMin` to stop simulation when stable
   - Disable simulation when graph is off-screen

3. **Database**:
   - Batch writes when possible
   - Debounce auto-save
   - Use transactions for multi-row operations

## Extension Points

**Custom Forces**:
```javascript
// Add custom force in forceSimulation.js
simulation.force("custom", () => {
  nodes.forEach(node => {
    // Custom force logic
  });
});
```

**Custom Node Types**:
```javascript
// Extend Node.jsx with type-based rendering
{node.type === 'image' ? <NodeImage /> : <NodeCircle />}
```

**Alternative Backends**:
```javascript
// Backend abstraction allows swapping databases:
// - Replace SurrealDB with PostgreSQL
// - Replace SurrealDB with MongoDB
// - Replace SurrealDB with SQLite
// Frontend API contract remains unchanged
```

---

## Error Handling Strategy

### Error Boundaries

**Component-Level Protection:**
```javascript
// src/components/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Graph Error:', error, errorInfo);
    // Optional: Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-state">
          <h2>Something went wrong</h2>
          <button onClick={() => window.location.reload()}>
            Reload Graph
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Usage:**
```javascript
<ErrorBoundary>
  <GraphCanvas />
</ErrorBoundary>
```

### Database Error Handling

**Graceful Degradation:**
```javascript
// db.js
export async function initDatabase() {
  try {
    const SQL = await initSqlJs({ /* ... */ });
    const savedData = await localforage.getItem('graphtool_db');
    // ... initialize
  } catch (error) {
    console.error('Database init failed:', error);
    // Fallback: In-memory only mode
    return createInMemoryDB();
  }
}
```

**Save Failure Recovery:**
```javascript
async function saveDatabase() {
  try {
    const data = db.export();
    await localforage.setItem('graphtool_db', data);
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      // Show user: storage full
      dispatch({ type: 'SHOW_ERROR', payload: 'Storage quota exceeded' });
    } else {
      // Retry with exponential backoff
      retryWithBackoff(saveDatabase);
    }
  }
}
```

### Simulation Error Handling

**Prevent Invalid States:**
```javascript
export function addEdge(simulation, link) {
  // Validate before adding
  if (!edge.source || !edge.target) {
    throw new Error('Link must have source and target');
  }

  const nodes = simulation.nodes();
  const sourceExists = nodes.find(n => n.id === link.source);
  const targetExists = nodes.find(n => n.id === link.target);

  if (!sourceExists || !targetExists) {
    throw new Error('Cannot add link: node not found');
  }

  // Safe to proceed
  const linkForce = simulation.force("link");
  linkForce.links([...linkForce.links(), link]);
}
```

### User-Facing Error Messages

**Error Toast System:**
```javascript
// Store error state
{
  ui: {
    error: { message: string, type: 'warning' | 'error' } | null
  }
}

// Display in UI
{state.ui.error && (
  <Toast type={state.ui.error.type}>
    {state.ui.error.message}
  </Toast>
)}
```

---

## Accessibility (A11y)

### Keyboard Navigation

**Essential Shortcuts:**
- `Tab` - Navigate between nodes
- `Enter` / `Space` - Select/activate node
- `Delete` - Delete selected node
- `Escape` - Clear selection
- `Arrow Keys` - Move selected node (when focused)

**Implementation:**
```javascript
// GraphCanvas.jsx
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Delete' && selectedNode) {
      dispatch({ type: 'DELETE_NODE', payload: selectedNode });
    }
    if (e.key === 'Escape') {
      dispatch({ type: 'CLEAR_SELECTION' });
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedNode]);
```

### ARIA Labels

**Node Component:**
```javascript
<g
  role="button"
  tabIndex={0}
  aria-label={`Node: ${node.label}${node.url ? `, link: ${node.url}` : ''}`}
  aria-pressed={isSelected}
  onKeyPress={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  <circle r={15} />
  <text>{node.label}</text>
</g>
```

**Canvas:**
```javascript
<svg
  role="application"
  aria-label="Interactive graph visualization"
  aria-describedby="graph-instructions"
>
  <desc id="graph-instructions">
    Use Tab to navigate nodes, Enter to select, Delete to remove
  </desc>
  {/* graph content */}
</svg>
```

### Screen Reader Support

**Live Regions for Updates:**
```javascript
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {`${state.graph.nodes.length} nodes, ${state.graph.edges.length} connections`}
</div>
```

**Announce Actions:**
```javascript
function announceAction(message) {
  const announcer = document.getElementById('announcer');
  announcer.textContent = message;
  // Clears after announcement
  setTimeout(() => announcer.textContent = '', 1000);
}

// Usage
dispatch({ type: 'ADD_NODE', payload: data });
announceAction(`Added node: ${data.label}`);
```

### Focus Management

**Trap Focus in Modals:**
```javascript
// NodeForm.jsx
useEffect(() => {
  const firstInput = formRef.current?.querySelector('input');
  firstInput?.focus();

  const handleTabKey = (e) => {
    const focusableElements = formRef.current.querySelectorAll(
      'input, button, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener('keydown', handleTabKey);
  return () => document.removeEventListener('keydown', handleTabKey);
}, []);
```

### Color Contrast

**WCAG AAA Compliance:**
```css
/* Ensure 7:1 contrast ratio */
.node-selected {
  fill: #0066cc;  /* Dark blue */
  stroke: #003366; /* Darker outline */
}

.edge {
  stroke: #4a5568; /* Gray with sufficient contrast */
  stroke-width: 2px;
}
```

### Reduced Motion

**Respect user preferences:**
```javascript
// Disable animation for users who prefer reduced motion
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

if (prefersReducedMotion) {
  simulation.alpha(0); // Disable physics
  simulation.stop();
}
```

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Loading States

### Initial Load Pattern

```javascript
const [loadingState, setLoadingState] = useState({
  db: 'loading',      // 'loading' | 'ready' | 'error'
  graph: 'loading',   // 'loading' | 'ready' | 'error'
  simulation: 'idle'  // 'idle' | 'running' | 'settled'
});

// Display loading UI
{loadingState.db === 'loading' && <LoadingSpinner />}
{loadingState.db === 'error' && <ErrorMessage />}
{loadingState.db === 'ready' && <GraphCanvas />}
```

### Optimistic Updates

**Immediate feedback, background persistence:**
```javascript
case 'ADD_NODE':
  const tempNode = { id: 'temp-' + Date.now(), ...action.payload };

  // Update UI immediately
  setState(prev => ({
    ...prev,
    graph: { ...prev.graph, nodes: [...prev.graph.nodes, tempNode] }
  }));

  // Persist in background
  createNode(action.payload)
    .then(realId => {
      // Replace temp ID with real ID
      setState(prev => ({
        ...prev,
        graph: {
          ...prev.graph,
          nodes: prev.graph.nodes.map(n =>
            n.id === tempNode.id ? { ...n, id: realId } : n
          )
        }
      }));
    })
    .catch(error => {
      // Rollback on failure
      setState(prev => ({
        ...prev,
        graph: {
          ...prev.graph,
          nodes: prev.graph.nodes.filter(n => n.id !== tempNode.id)
        }
      }));
      showError('Failed to add node');
    });
```
