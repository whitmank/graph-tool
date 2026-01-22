# Database Module

## Overview
GraphTool uses **SurrealDB** - a modern multi-model database - for server-side data persistence. The backend manages the SurrealDB process and exposes a REST API for the frontend to consume.

**Architecture**: Client-Server
- **Backend**: Node.js + Express + SurrealDB
- **Frontend**: React (consumes REST API)
- **Storage**: File-based (data/graphtool.db/)

---

## Schema Design

### Nodes Collection (Table)

**Document Structure**:
```javascript
{
  id: "nodes:abc123",          // SurrealDB auto-generated ID
  label: "React Documentation", // Required display name
  url: "https://react.dev",     // Optional external link
  x: 150.5,                     // X position from D3 (nullable)
  y: 200.3,                     // Y position from D3 (nullable)
  created_at: "2025-12-31T12:00:00Z",
  updated_at: "2025-12-31T12:30:00Z"  // Optional
}
```

**Fields**:
- `id`: SurrealDB record ID (format: `nodes:uniqueid`)
- `label`: Display name (required)
- `url`: Optional external link
- `x`, `y`: Position cache from D3 simulation (nullable)
- `created_at`: ISO 8601 timestamp
- `updated_at`: ISO 8601 timestamp (set on updates)

### Links Collection (Table)

**Document Structure**:
```javascript
{
  id: "links:xyz789",           // SurrealDB auto-generated ID
  source_id: "nodes:abc123",    // Reference to source node
  target_id: "nodes:def456",    // Reference to target node
  label: "depends on",          // Optional relationship description
  created_at: "2025-12-31T12:00:00Z",
  updated_at: "2025-12-31T12:30:00Z"  // Optional
}
```

**Fields**:
- `id`: SurrealDB record ID (format: `links:uniqueid`)
- `source_id`: Starting node ID (string reference)
- `target_id`: Ending node ID (string reference)
- `label`: Optional relationship description
- `created_at`: ISO 8601 timestamp
- `updated_at`: ISO 8601 timestamp (set on updates)

**Notes**:
- SurrealDB handles schema-less documents (no formal CREATE TABLE needed)
- Referential integrity handled at application level
- Cascade deletes implemented in `db-service.js` deleteNode() function

---

## File-Based Persistence

**Architecture**: Files are the **source of truth**. SurrealDB serves as an ephemeral in-memory cache for fast queries.

### Storage Model

**Primary Storage**: JSON files on disk
- **Location**: `files/nodes/` and `files/links/` directories
- **Format**: One JSON file per node/link
- **Naming**: `{table}_{id-suffix}.json`
  - Example: `nodes:abc123` → `node_abc123.json`
  - Example: `links:xyz789` → `link_xyz789.json`

**Cache Layer**: SurrealDB in-memory database
- **Purpose**: Fast querying and relationships
- **Lifecycle**: Populated on server startup from files
- **Persistence**: None - recreated from files each start

### File Structure Examples

**Node file** (`files/nodes/node_abc123.json`):
```json
{
  "id": "nodes:abc123",
  "label": "React Documentation",
  "url": "https://react.dev",
  "x": 150.5,
  "y": 200.3,
  "created_at": "2025-12-31T12:00:00Z",
  "updated_at": "2025-12-31T12:30:00Z"
}
```

**Link file** (`files/links/link_xyz789.json`):
```json
{
  "id": "links:xyz789",
  "source_id": "nodes:abc123",
  "target_id": "nodes:def456",
  "label": "depends on",
  "created_at": "2025-12-31T12:00:00Z"
}
```

### Data Flow

**On Server Startup**:
1. Read all JSON files from `files/nodes/` and `files/links/`
2. Validate and parse JSON
3. Populate SurrealDB cache with all records
4. Start file watchers for live sync

**On Create/Update**:
1. Write to SurrealDB (fast response)
2. Write to JSON file asynchronously (durability)
3. Broadcast WebSocket update to connected clients

**On Delete**:
1. Delete from SurrealDB
2. Delete JSON file
3. For node deletes: cascade delete all connected link files
4. Broadcast WebSocket update

**On External File Change** (file watcher):
1. Detect file add/change/delete
2. Update SurrealDB cache accordingly
3. Broadcast WebSocket update to clients

### Atomic Writes

File writes use atomic write-then-rename pattern:
1. Write to temporary file (`*.json.tmp`)
2. Atomically rename to target filename
3. Prevents corruption if write is interrupted

---

## Data Source Management

GraphTool supports **multiple data sources** with hot-reload capability.

### Configuration

**File**: `data-sources.json` (project root)

```json
{
  "current": "default",
  "sources": {
    "default": {
      "name": "Default (Project Files)",
      "path": "./files",
      "description": "Default data storage in project folder"
    },
    "external": {
      "name": "External Drive",
      "path": "/Volumes/External/graphtool-data",
      "description": "Backup data on external drive"
    }
  }
}
```

### Data Source Operations

**Switch Source** (hot reload without server restart):
1. Validate new source path exists
2. Stop file watchers
3. Clear SurrealDB cache
4. Load files from new source
5. Restart file watchers on new path
6. Broadcast update to clients

**Add Source**:
```javascript
// POST /api/data-sources
{
  "id": "project-backup",
  "name": "Project Backup",
  "path": "/Users/me/backups/graphtool",
  "description": "Monthly backup location"
}
```

**Developer Interface**: Available at `/dev` route with UI for managing sources

---

## Backend API (db-service.js)

### Node Operations

#### getAllNodes()
```javascript
async function getAllNodes() {
  const result = await db.query('SELECT * FROM nodes ORDER BY label');
  return result[0] || [];
}
```

**Returns**: Array of node objects

---

#### getNode(id)
```javascript
async function getNode(id) {
  const result = await db.query(`SELECT * FROM ${id}`);
  return result[0]?.[0] || null;
}
```

**Parameters**:
- `id`: SurrealDB record ID (e.g., "nodes:abc123")

**Returns**: Node object or null

---

#### createNode(data)
```javascript
async function createNode(data) {
  const result = await db.create('nodes', {
    label: data.label,
    url: data.url || null,
    x: data.x || null,
    y: data.y || null,
    created_at: new Date().toISOString()
  });
  return Array.isArray(result) ? result[0] : result;
}
```

**Parameters**:
- `data.label`: (required) Node display name
- `data.url`: (optional) External link
- `data.x`, `data.y`: (optional) Position coordinates

**Returns**: Created node object with auto-generated ID

---

#### updateNode(id, data)
```javascript
async function updateNode(id, data) {
  const updateQuery = `UPDATE ${id} SET
    label = $label,
    url = $url,
    x = $x,
    y = $y,
    updated_at = $updated_at`;

  const result = await db.query(updateQuery, {
    label: data.label,
    url: data.url || null,
    x: data.x,
    y: data.y,
    updated_at: new Date().toISOString()
  });

  return result[0]?.[0] || null;
}
```

**Parameters**:
- `id`: SurrealDB record ID
- `data`: Object with fields to update

**Returns**: Updated node object

---

#### deleteNode(id)
```javascript
async function deleteNode(id) {
  // Delete all connected links first
  await db.query('DELETE FROM links WHERE source_id = $id OR target_id = $id', { id });

  // Then delete the node
  await db.query(`DELETE ${id}`);

  return { success: true, id };
}
```

**Parameters**:
- `id`: SurrealDB record ID

**Returns**: Success object

**Note**: Cascade deletes all links connected to this node

---

### Link Operations

#### getAllLinks()
```javascript
async function getAllLinks() {
  const result = await db.query('SELECT * FROM links');
  return result[0] || [];
}
```

**Returns**: Array of link objects

---

#### getLink(id)
```javascript
async function getLink(id) {
  const result = await db.query(`SELECT * FROM ${id}`);
  return result[0]?.[0] || null;
}
```

---

#### createLink(data)
```javascript
async function createLink(data) {
  const result = await db.create('links', {
    source_id: data.source_id,
    target_id: data.target_id,
    label: data.label || null,
    created_at: new Date().toISOString()
  });
  return Array.isArray(result) ? result[0] : result;
}
```

**Parameters**:
- `data.source_id`: (required) Source node ID
- `data.target_id`: (required) Target node ID
- `data.label`: (optional) Relationship description

---

#### updateLink(id, data)
```javascript
async function updateLink(id, data) {
  const updateQuery = `UPDATE ${id} SET
    label = $label,
    updated_at = $updated_at`;

  const result = await db.query(updateQuery, {
    label: data.label || null,
    updated_at: new Date().toISOString()
  });

  return result[0]?.[0] || null;
}
```

---

#### deleteLink(id)
```javascript
async function deleteLink(id) {
  await db.query(`DELETE ${id}`);
  return { success: true, id };
}
```

---

#### getNodeLinks(nodeId)
```javascript
async function getNodeLinks(nodeId) {
  const result = await db.query(
    'SELECT * FROM links WHERE source_id = $nodeId OR target_id = $nodeId',
    { nodeId }
  );
  return result[0] || [];
}
```

**Description**: Get all links connected to a specific node

---

## Frontend REST API

The backend Express server exposes HTTP endpoints that the React frontend consumes.

### Node Endpoints

#### GET /api/nodes
**Description**: Get all nodes

**Response**:
```javascript
[
  {
    id: "nodes:abc123",
    label: "React Documentation",
    url: "https://react.dev",
    x: 150.5,
    y: 200.3,
    created_at: "2025-12-31T12:00:00Z"
  }
]
```

---

#### GET /api/nodes/:id
**Description**: Get a single node by ID

**Example**: `GET /api/nodes/nodes:abc123`

**Response**:
```javascript
{
  id: "nodes:abc123",
  label: "React Documentation",
  url: "https://react.dev",
  x: 150.5,
  y: 200.3
}
```

---

#### POST /api/nodes
**Description**: Create a new node

**Request Body**:
```javascript
{
  label: "React Documentation",   // required
  url: "https://react.dev"        // optional
}
```

**Response**: Created node object with auto-generated ID

**Example cURL**:
```bash
curl -X POST http://localhost:3000/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"label":"React Docs","url":"https://react.dev"}'
```

---

#### PUT /api/nodes/:id
**Description**: Update an existing node

**Request Body**:
```javascript
{
  label: "Updated Label",
  url: "https://newurl.com",
  x: 200,
  y: 150
}
```

**Response**: Updated node object

---

#### DELETE /api/nodes/:id
**Description**: Delete a node (and all connected links)

**Response**:
```javascript
{
  success: true,
  id: "nodes:abc123"
}
```

---

### Link Endpoints

#### GET /api/links
**Description**: Get all links

**Response**: Array of link objects

---

#### GET /api/links/:id
**Description**: Get a single link by ID

---

#### POST /api/links
**Description**: Create a new link

**Request Body**:
```javascript
{
  source_id: "nodes:abc123",      // required
  target_id: "nodes:def456",      // required
  label: "depends on"             // optional
}
```

**Response**: Created link object

---

#### PUT /api/links/:id
**Description**: Update an link

**Request Body**:
```javascript
{
  label: "new relationship type"
}
```

---

#### DELETE /api/links/:id
**Description**: Delete an link

---

#### GET /api/nodes/:id/links
**Description**: Get all links connected to a specific node

**Example**: `GET /api/nodes/nodes:abc123/links`

**Response**: Array of link objects where source_id or target_id matches the node ID

---

## Frontend Usage Examples

### Fetching Nodes
```javascript
// In React component
useEffect(() => {
  fetch('/api/nodes')
    .then(res => res.json())
    .then(nodes => {
      dispatch({ type: 'LOAD_NODES', payload: nodes });
    });
}, []);
```

### Creating a Node
```javascript
async function handleCreateNode(label, url) {
  const response = await fetch('/api/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, url })
  });

  const newNode = await response.json();
  dispatch({ type: 'ADD_NODE', payload: newNode });
}
```

### Updating Node Position (from D3 simulation)
```javascript
async function saveNodePosition(nodeId, x, y) {
  await fetch(`/api/nodes/${nodeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y })
  });
}
```

### Deleting a Node
```javascript
async function handleDeleteNode(nodeId) {
  await fetch(`/api/nodes/${nodeId}`, {
    method: 'DELETE'
  });

  dispatch({ type: 'DELETE_NODE', payload: nodeId });
}
```

---

## WebSocket API

GraphTool uses WebSockets for **real-time updates** across all connected clients.

### Connection

**Endpoint**: `ws://localhost:3000`

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  console.log('[WebSocket] Connected to server');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleDataChange(message);
};
```

### Message Format

All WebSocket messages follow this structure:

```javascript
{
  "type": "node" | "link",
  "action": "added" | "updated" | "deleted",
  "id": "nodes:abc123" | "links:xyz789"
}
```

### Event Types

**Node Events**:
- `{type: "node", action: "added", id: "nodes:abc123"}` - New node created
- `{type: "node", action: "updated", id: "nodes:abc123"}` - Node updated
- `{type: "node", action: "deleted", id: "nodes:abc123"}` - Node deleted

**Link Events**:
- `{type: "link", action: "added", id: "links:xyz789"}` - New link created
- `{type: "link", action: "updated", id: "links:xyz789"}` - Link updated
- `{type: "link", action: "deleted", id: "links:xyz789"}` - Link deleted

### Frontend Integration

```javascript
useEffect(() => {
  const ws = new WebSocket('ws://localhost:3000');

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'node') {
      loadNodes(); // Refresh nodes from API
      if (message.action === 'deleted') {
        loadLinks(); // Node delete cascades to links
      }
    } else if (message.type === 'link') {
      loadLinks(); // Refresh links from API
    }
  };

  return () => ws.close();
}, []);
```

### Broadcast Triggers

WebSocket broadcasts are sent when:
1. **API operations**: Any REST API create/update/delete
2. **File watcher events**: External file changes detected
3. **Data source switches**: When switching data sources

This ensures all clients stay synchronized in real-time.

---

## Development Workflow

### Starting the Server
```bash
# Install dependencies first
npm install

# Start the server (spawns SurrealDB + Express)
npm start
# or
node server.js
```

**Console Output**:
```
🚀 Starting SurrealDB...
[SurrealDB]: Started web server on 127.0.0.1:8000
✅ SurrealDB is ready!
✅ Connected to SurrealDB

🌐 GraphTool server running on http://localhost:3000
📊 SurrealDB running on http://127.0.0.1:8000
```

### Testing the API
```bash
# Get all nodes
curl http://localhost:3000/api/nodes

# Create a node
curl -X POST http://localhost:3000/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"label":"Test Node","url":"https://example.com"}'

# Update a node (replace ID with actual ID from create response)
curl -X PUT http://localhost:3000/api/nodes/nodes:abc123 \
  -H "Content-Type: application/json" \
  -d '{"label":"Updated Node"}'

# Delete a node
curl -X DELETE http://localhost:3000/api/nodes/nodes:abc123
```

---

## Prerequisites

### SurrealDB Installation
GraphTool requires SurrealDB to be installed on your system.

**macOS**:
```bash
brew install surrealdb/tap/surreal
```

**Linux**:
```bash
curl -sSf https://install.surrealdb.com | sh
```

**Windows**:
```powershell
iwr https://install.surrealdb.com -useb | iex
```

**Verify Installation**:
```bash
surreal version
```

See [SurrealDB docs](https://surrealdb.com/docs/installation) for more installation options.

