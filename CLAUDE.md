# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GraphTool is a browser-based interactive network diagram tool for visualizing semantic graphs using force-directed layout. It features a **client-server architecture** with React frontend, Express backend, SurrealDB database, and D3.js physics simulation.

**Core principle**: Files are the source of truth. SurrealDB acts as an ephemeral in-memory cache for fast queries.

## Development Commands

### Server & Development
```bash
# Install all dependencies (backend + frontend)
npm run install:all

# Start production server (backend serves frontend/dist)
# Starts Express on port 3000, serves /frontend/dist + API, spawns SurrealDB
npm start

# Development (run in separate terminals)
npm run dev:backend     # Terminal 1: Express + SurrealDB on port 3000
npm run dev:frontend    # Terminal 2: Vite dev server on port 5173

# Build frontend for production
npm run build:frontend  # Output to /frontend/dist

# Build and start production
npm run build:start

# Lint code
npm run lint
```

### Testing the API
```bash
# Get all nodes
curl http://localhost:3000/api/nodes

# Create a node
curl -X POST http://localhost:3000/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"label":"Test Node","url":"https://example.com"}'

# Update a node (replace ID)
curl -X PUT http://localhost:3000/api/nodes/nodes:abc123 \
  -H "Content-Type: application/json" \
  -d '{"label":"Updated Node"}'

# Delete a node
curl -X DELETE http://localhost:3000/api/nodes/nodes:abc123
```

## Architecture

### Modular Design (5 Independent Modules)

**Module A: Database/Persistence** (Backend)
- **Location**: `backend/`
- **Files**: `src/server.js`, `src/services/db-service.js`, `src/services/file-service.js`, `src/services/data-source-service.js`
- **Role**: SurrealDB management, REST API, file persistence, WebSocket broadcasting
- **Independence**: Backend is standalone; frontend consumes via HTTP REST API
- **Swap**: Can replace SurrealDB with any database (PostgreSQL, MongoDB, etc.)

**Module B: Physics Engine** (Frontend)
- **Location**: `frontend/`
- **Files**: `src/engine/forceSimulation.js`, `src/engine/simulationControls.js`
- **Role**: D3 force simulation for node positioning
- **Independence**: Fully standalone, no dependencies on other modules
- **Swap**: Can replace D3 with Matter.js, custom physics, or static layouts

**Module C: React Rendering** (Frontend)
- **Location**: `frontend/`
- **Files**: `src/components/GraphCanvas.jsx`, `Node.jsx`, `Link.jsx`, `NodeDetailPanel.jsx`
- **Role**: SVG visualization based on simulation positions
- **Dependencies**: Requires Module D (state)
- **Swap**: Can replace SVG with Canvas, WebGL, or HTML elements

**Module D: State Management** (Frontend)
- **Location**: `frontend/`
- **Files**: `src/store/GraphContext.jsx`, `src/store/graphReducer.js`
- **Role**: Orchestrates Modules A, B, C, E (integration layer)
- **Dependencies**: Integrates all modules (intentionally coupled)
- **Swap**: Can replace Context+Reducer with Redux, Zustand, MobX

**Module E: UI Shell** (Frontend)
- **Location**: `frontend/`
- **Files**: `src/components/ui/App.jsx`, `Toolbar.jsx`, `NodeForm.jsx`, `EdgeForm.jsx`, `ContextMenu.jsx`
- **Role**: User controls, forms, interactions
- **Dependencies**: Requires Module D (state)
- **Swap**: Can redesign entire UI without touching other modules

**Module F: Developer Interface** (Frontend)
- **Location**: `frontend/`
- **File**: `src/DevInterface.jsx`
- **Route**: `/dev`
- **Role**: CRUD interface for nodes, links, and data sources
- **Features**: Manage data sources, switch between them, real-time WebSocket updates

### Dependency Graph
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
                         │
F (DevInterface) ←───────┘
```

### Data Flow

**Client → Server (Create/Update)**:
1. Client → HTTP POST/PUT → Express API
2. Express → db-service → SurrealDB (fast cache write)
3. db-service → file-service → JSON file (durable write)
4. file-service → WebSocket broadcast (all clients notified)

**Server Startup**:
1. Load all JSON files from `files/nodes/` and `files/links/`
2. Populate SurrealDB in-memory cache
3. Start file watchers (chokidar) for external changes
4. Start WebSocket server for real-time updates

**External File Change**:
1. File watcher detects change
2. Update SurrealDB cache
3. WebSocket broadcast to all clients
4. Clients reload data from API

### File-Based Persistence

**Primary Storage**: JSON files (source of truth)
- **Location**: `files/nodes/` and `files/links/`
- **Format**: One JSON file per node/link
- **Naming**: `{table}_{id-suffix}.json`
  - Example: `nodes:abc123` → `node_abc123.json`
  - Example: `links:xyz789` → `link_xyz789.json`

**Cache Layer**: SurrealDB (ephemeral)
- **Purpose**: Fast querying and relationships
- **Lifecycle**: Populated on startup from files
- **Persistence**: None - rebuilt from files each start

**Atomic Writes**: Write to `.tmp` file, then rename (prevents corruption)

**Data Sources**: Support multiple data directories with hot reload
- **Config**: `data-sources.json` (project root)
- **Switch**: Change data source without server restart
- **UI**: Manage via `/dev` interface

## Key Integration Patterns

### D3 + React Integration

**Core principle**: React for rendering, D3 for math
- **D3**: Calculates physics (force simulation, positions)
- **React**: Renders UI based on those calculations
- **D3 never touches the DOM** - only provides data

**Setup Phase**:
```javascript
// GraphCanvas.jsx - initialize simulation once
useEffect(() => {
  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d => d.id))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width/2, height/2));
  setSimulation(sim);
}, []);
```

**Tick Phase**:
```javascript
// Update React state with new positions every frame
simulation.on("tick", () => {
  setNodes([...simulation.nodes()]);
});
```

**Interaction Phase**:
```javascript
// When user drags a node
function handleDrag(node) {
  node.fx = event.x;  // Fix position during drag
  node.fy = event.y;
  simulation.alpha(0.3).restart();  // Reheat simulation
}
```

### REST API Endpoints

**Nodes**:
- `GET /api/nodes` - Get all nodes
- `GET /api/nodes/:id` - Get single node
- `POST /api/nodes` - Create node (body: `{label, url?}`)
- `PUT /api/nodes/:id` - Update node
- `DELETE /api/nodes/:id` - Delete node (cascade deletes links)

**Links**:
- `GET /api/links` - Get all links
- `GET /api/links/:id` - Get single link
- `POST /api/links` - Create link (body: `{source_id, target_id, label?}`)
- `PUT /api/links/:id` - Update link
- `DELETE /api/links/:id` - Delete link
- `GET /api/nodes/:id/links` - Get all links for a node

**Data Sources**:
- `GET /api/data-sources` - Get all sources
- `GET /api/data-sources/current` - Get current source
- `POST /api/data-sources` - Add new source
- `PUT /api/data-sources/switch/:id` - Switch to source (hot reload)
- `DELETE /api/data-sources/:id` - Remove source

### WebSocket Protocol

**Connection**: `ws://localhost:3000`

**Message Format**:
```json
{
  "type": "node" | "link",
  "action": "added" | "updated" | "deleted",
  "id": "nodes:abc123"
}
```

**Broadcast Triggers**:
- REST API operations (create/update/delete)
- File watcher events (external file changes)
- Data source switches

## Database Schema

### Nodes Collection
```javascript
{
  id: "nodes:abc123",          // SurrealDB auto-generated
  label: "React Documentation", // Required
  url: "https://react.dev",     // Optional
  x: 150.5,                     // D3 position cache (nullable)
  y: 200.3,                     // D3 position cache (nullable)
  created_at: "2025-12-31T12:00:00Z",
  updated_at: "2025-12-31T12:30:00Z"
}
```

### Links Collection
```javascript
{
  id: "links:xyz789",
  source_id: "nodes:abc123",    // Reference to source node
  target_id: "nodes:def456",    // Reference to target node
  label: "depends on",          // Optional
  created_at: "2025-12-31T12:00:00Z",
  updated_at: "2025-12-31T12:30:00Z"
}
```

**Note**: Referential integrity and cascade deletes handled at application level in `db-service.js` deleteNode() function.

## State Management

**Strategy**: React Context + useReducer

**State Structure**:
```javascript
{
  graph: {
    nodes: [{id, label, url, x, y}, ...],
    links: [{id, source, target, label}, ...]
  },
  ui: {
    selectedNode: id | null,
    selectedLink: id | null,
    isAddingLink: false,
    linkSourceNode: id | null
  },
  simulation: d3.forceSimulation() // Reference to D3 instance
}
```

**Key Actions**:
- `LOAD_GRAPH` - Load from database
- `ADD_NODE` - Create node in DB and simulation
- `UPDATE_NODE` - Update node properties
- `DELETE_NODE` - Remove from DB and simulation (cascade delete links)
- `ADD_LINK` - Create link
- `DELETE_LINK` - Remove link
- `SELECT_NODE` - Update selectedNode
- `UPDATE_POSITIONS` - Simulation tick update

## Prerequisites

### SurrealDB Installation
GraphTool requires SurrealDB 1.3+ to be installed:

```bash
# macOS
brew install surrealdb/tap/surreal

# Linux
curl -sSf https://install.surrealdb.com | sh

# Windows
iwr https://install.surrealdb.com -useb | iex

# Verify installation
surreal version
```

### System Requirements
- **Backend**: Node.js 18+, SurrealDB 1.3+
- **Frontend**: Chrome/Edge 90+, Firefox 88+, Safari 14+

## Project Structure
```
graphtool_0.1/
├── backend/                    # Backend module (Module A)
│   ├── src/
│   │   ├── server.js          # Express API server + SurrealDB manager
│   │   ├── services/          # Business logic
│   │   │   ├── db-service.js          # SurrealDB client wrapper (CRUD)
│   │   │   ├── file-service.js        # File I/O, atomic writes, watchers
│   │   │   └── data-source-service.js # Multi-source data management
│   │   ├── utils/             # Utilities
│   │   │   ├── events.js      # EventEmitter for broadcasts
│   │   │   └── config.js      # Configuration constants
│   │   └── types/             # JSDoc type definitions
│   │       ├── node.js
│   │       └── link.js
│   ├── package.json
│   └── README.md
│
├── frontend/                   # Frontend module (Modules B-F)
│   ├── src/
│   │   ├── engine/            # Module B: D3 force simulation
│   │   ├── store/             # Module D: State management
│   │   ├── components/        # Module C: React visualization
│   │   │   └── ui/           # Module E: UI controls
│   │   ├── DevInterface.jsx   # Module F: Developer CRUD interface
│   │   └── main.jsx
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── README.md
│
├── files/                      # Primary data storage (source of truth)
│   ├── nodes/                 # Node JSON files
│   └── links/                 # Link JSON files
│
├── data/                       # SurrealDB ephemeral storage
│   └── graphtool.db/
│
├── docs/                       # Comprehensive documentation
│   ├── ARCHITECTURE.md        # System design and data flow
│   ├── DATABASE.md            # Schema and API reference
│   ├── MODULES.md             # Module specifications
│   ├── QUICKSTART.md          # Get running in 5 minutes
│   └── SETUP.md               # Development environment
│
├── data-sources.json           # Data source configuration
├── package.json                # Root orchestration scripts
├── .gitignore
├── CLAUDE.md
└── README.md
```

## Common Patterns

### Adding a New Node
```javascript
// Frontend dispatch
dispatch({ type: 'ADD_NODE', payload: { label: 'New Node', url: '' } });

// Reducer (graphReducer.js):
// 1. Call createNode() → write to SurrealDB + file
// 2. Call simulation.add() → add to D3 physics
// 3. Update state.graph.nodes → trigger re-render
```

### Updating Node Position (from D3)
```javascript
// Save position after drag
async function saveNodePosition(nodeId, x, y) {
  await fetch(`/api/nodes/${nodeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y })
  });
}
```

### Cascade Delete Pattern
When deleting a node:
1. Delete all connected links first (in `db-service.js`)
2. Delete link JSON files (in `file-service.js`)
3. Delete the node from SurrealDB
4. Delete node JSON file
5. Broadcast WebSocket update

## Performance Considerations

**React Rendering**:
- Use `React.memo` for Node/Link components
- Stable keys (node.id) prevent unnecessary re-renders
- Consider throttling tick updates for large graphs (>500 nodes)

**Simulation Performance**:
- Adjust `alphaDecay` to balance settling speed vs frame rate
- Use `alphaMin` to stop simulation when stable
- Disable simulation when graph is off-screen

**Database**:
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
- Replace SurrealDB with PostgreSQL, MongoDB, or SQLite
- Frontend API contract remains unchanged
- Only modify `db-service.js` implementation

## Routes
- `/` - Main graph visualization interface
- `/dev` - Developer CRUD interface (nodes, links, data sources)
- `/health` - Server health check
- `/api/*` - REST API endpoints

## Tech Stack
- **Frontend**: React 19 + Vite 7
- **Visualization**: D3.js v7 (force simulation)
- **Backend**: Node.js + Express 5
- **Database**: SurrealDB 1.3+ (ephemeral cache)
- **Storage**: File-based JSON (source of truth)
- **Real-time**: WebSocket (ws library)
- **File Watching**: chokidar
