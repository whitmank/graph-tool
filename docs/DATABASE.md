# Database Module

## Overview
GraphTool uses sql.js (SQLite compiled to WebAssembly) for client-side data persistence. All graph data lives in a single SQLite database stored in the browser.

## Schema Design

### Nodes Table
```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  url TEXT,
  x REAL,
  y REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Fields**:
- `id`: UUID (e.g., "550e8400-e29b-41d4-a716-446655440000")
- `label`: Display name (e.g., "React Documentation")
- `url`: Optional external link (e.g., "https://react.dev")
- `x`, `y`: Position cache from D3 simulation (nullable)
- `created_at`: Timestamp for sorting/auditing

**Indexes**:
```sql
CREATE INDEX idx_nodes_created ON nodes(created_at);
```

### Edges Table
```sql
CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  label TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
);
```

**Fields**:
- `id`: UUID
- `source_id`: Starting node
- `target_id`: Ending node
- `label`: Optional relationship description (e.g., "depends on")
- `created_at`: Timestamp

**Indexes**:
```sql
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
```

**Constraints**:
- Cascade delete: Deleting a node removes all connected edges
- No self-loops enforced at app level (not DB constraint)

## CRUD Operations API

### Nodes

#### getAllNodes()
```javascript
function getAllNodes() {
  const stmt = db.prepare("SELECT * FROM nodes ORDER BY created_at");
  const result = [];
  while (stmt.step()) {
    result.push({
      id: stmt.getAsObject().id,
      label: stmt.getAsObject().label,
      url: stmt.getAsObject().url,
      x: stmt.getAsObject().x,
      y: stmt.getAsObject().y
    });
  }
  stmt.free();
  return result;
}
```

#### createNode(data)
```javascript
function createNode({ label, url = null }) {
  const id = crypto.randomUUID();
  db.run(
    "INSERT INTO nodes (id, label, url) VALUES (?, ?, ?)",
    [id, label, url]
  );
  return id;
}
```

#### updateNode(id, data)
```javascript
function updateNode(id, { label, url, x, y }) {
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
    updates.push("x = ?, y = ?");
    values.push(x, y);
  }

  values.push(id);
  db.run(
    `UPDATE nodes SET ${updates.join(", ")} WHERE id = ?`,
    values
  );
}
```

#### deleteNode(id)
```javascript
function deleteNode(id) {
  db.run("DELETE FROM nodes WHERE id = ?", [id]);
  // Edges cascade delete automatically
}
```

### Edges

#### getAllEdges()
```javascript
function getAllEdges() {
  const stmt = db.prepare("SELECT * FROM edges ORDER BY created_at");
  const result = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    result.push({
      id: row.id,
      source: row.source_id,  // D3 expects 'source', not 'source_id'
      target: row.target_id,  // D3 expects 'target', not 'target_id'
      label: row.label
    });
  }
  stmt.free();
  return result;
}
```

#### createEdge(data)
```javascript
function createEdge({ source_id, target_id, label = null }) {
  const id = crypto.randomUUID();
  db.run(
    "INSERT INTO edges (id, source_id, target_id, label) VALUES (?, ?, ?, ?)",
    [id, source_id, target_id, label]
  );
  return id;
}
```

#### updateEdge(id, { label })
```javascript
function updateEdge(id, { label }) {
  db.run("UPDATE edges SET label = ? WHERE id = ?", [label, id]);
}
```

#### deleteEdge(id)
```javascript
function deleteEdge(id) {
  db.run("DELETE FROM edges WHERE id = ?", [id]);
}
```

## Persistence Strategy

### Browser Storage: IndexedDB
sql.js databases are in-memory by default. We persist by exporting the binary to IndexedDB.

**Why IndexedDB over localStorage?**
- Storage limit: ~50MB+ vs 5MB
- Stores binary blobs efficiently
- Asynchronous API (non-blocking)

### Save Flow
```javascript
import localforage from 'localforage';

async function saveDatabase() {
  const data = db.export();  // Uint8Array
  await localforage.setItem('graphtool_db', data);
}

// Debounced auto-save after mutations
const debouncedSave = debounce(saveDatabase, 500);
```

### Load Flow
```javascript
async function loadDatabase() {
  const data = await localforage.getItem('graphtool_db');

  if (data) {
    db = new SQL.Database(data);
  } else {
    db = new SQL.Database();
    initSchema();  // Create tables
  }
}
```

### Export/Import Features

#### Export to File
```javascript
function exportToFile() {
  const data = db.export();
  const blob = new Blob([data], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `graph_${Date.now()}.sqlite`;
  a.click();
}
```

#### Import from File
```javascript
function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    db = new SQL.Database(data);

    // Reload graph from new DB
    const nodes = getAllNodes();
    const edges = getAllEdges();
    dispatch({ type: 'LOAD_GRAPH', payload: { nodes, edges } });
  };
  reader.readAsArrayBuffer(file);
}
```

## Initialization

### Database Setup (`db.js`)
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
    CREATE TABLE edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      label TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX idx_edges_source ON edges(source_id)`);
  db.run(`CREATE INDEX idx_edges_target ON edges(target_id)`);
}
```

## Position Caching

**Why store x, y in database?**
- Preserve user's manual node positioning
- Faster initial render (skip simulation convergence)
- Resume graph layout exactly as user left it

**When to update positions?**
```javascript
// After simulation settles (alpha < threshold)
simulation.on("end", () => {
  nodes.forEach(node => {
    updateNode(node.id, { x: node.x, y: node.y });
  });
  debouncedSave();
});

// Or periodically during interaction
let lastSave = Date.now();
simulation.on("tick", () => {
  if (Date.now() - lastSave > 5000) {
    // Save positions every 5 seconds
    nodes.forEach(node => updateNode(node.id, { x: node.x, y: node.y }));
    debouncedSave();
    lastSave = Date.now();
  }
});
```

## Data Validation

**Input Validation** (at app layer, before DB):
```javascript
function validateNode({ label, url }) {
  if (!label || label.trim().length === 0) {
    throw new Error("Label is required");
  }
  if (url && !isValidURL(url)) {
    throw new Error("Invalid URL format");
  }
}

function validateEdge({ source_id, target_id }) {
  if (source_id === target_id) {
    throw new Error("Self-loops not allowed");
  }
  if (!nodeExists(source_id) || !nodeExists(target_id)) {
    throw new Error("Source or target node does not exist");
  }
}
```

## Performance

**Batch Operations**:
```javascript
function createMultipleNodes(nodeArray) {
  db.run("BEGIN TRANSACTION");
  nodeArray.forEach(data => createNode(data));
  db.run("COMMIT");
}
```

**Query Optimization**:
- Use prepared statements for repeated queries
- Index on frequently queried columns (source_id, target_id)
- Avoid SELECT * when only specific columns needed

## Migration Strategy

**Future Schema Changes**:
```javascript
// Version tracking
db.run("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER)");

function migrate() {
  const version = getCurrentVersion();

  if (version < 2) {
    db.run("ALTER TABLE nodes ADD COLUMN color TEXT");
    updateVersion(2);
  }

  if (version < 3) {
    db.run("CREATE TABLE tags (...)");
    updateVersion(3);
  }
}
```
