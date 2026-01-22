# Backend Implementation Guide

## Overview

GraphTool's backend is a Node.js/Express server that manages:
- **File-based persistence**: JSON files as source of truth
- **SurrealDB cache**: Fast in-memory query engine
- **WebSocket updates**: Real-time synchronization across clients
- **Data source management**: Hot-swappable data directories

## Architecture

```
┌─────────────────────────────────────────────┐
│               server.js                      │
│  ┌──────────────────────────────────────┐  │
│  │ Express + WebSocket Server           │  │
│  │ - HTTP REST API                      │  │
│  │ - WebSocket broadcast                │  │
│  │ - Static file serving                │  │
│  └────────┬──────────┬──────────┬────────┘  │
│           ↓          ↓          ↓            │
│  ┌────────────┐ ┌──────────┐ ┌─────────┐   │
│  │ db-service │ │  file-   │ │data-src │   │
│  │            │ │  service │ │ service │   │
│  └─────┬──────┘ └────┬─────┘ └────┬────┘   │
│        ↓             ↓             ↓         │
│  ┌─────────┐   ┌─────────┐  ┌──────────┐   │
│  │SurrealDB│   │JSON     │  │data-src  │   │
│  │(cache)  │   │files/   │  │.json     │   │
│  └─────────┘   └─────────┘  └──────────┘   │
└─────────────────────────────────────────────┘
```

---

## server.js - Main Application Server

**Purpose**: Entry point, manages SurrealDB process, Express server, and WebSocket

### Startup Sequence

```javascript
async function start() {
  // 1. Ensure directory structure
  await fileService.ensureDirectories();

  // 2. Start SurrealDB child process
  await startDatabase();

  // 3. Connect db-service to SurrealDB
  await dbService.connect();

  // 4. Load JSON files into SurrealDB cache
  const { nodes, links, errors } = await fileService.loadAllFiles();
  await dbService.populateFromFiles(nodes, links);

  // 5. Start file watchers for live sync
  fileService.startWatchers();

  // 6. Start Express + WebSocket server
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
```

### Key Responsibilities

1. **SurrealDB Process Management**
   - Spawn child process with `file://graphtool.db`
   - Monitor stdout/stderr for readiness signals
   - Handle graceful shutdown

2. **Express API Routes**
   - `/api/nodes` - Node CRUD operations
   - `/api/links` - Link CRUD operations
   - `/api/data-sources` - Data source management
   - Static file serving from `/dist`

3. **WebSocket Broadcasting**
   - Maintain set of connected clients
   - Broadcast data change events to all clients
   - Handle client connect/disconnect

### WebSocket Implementation

```javascript
const wss = new WebSocketServer({ server });

global.broadcastDataChange = (type, action, id) => {
  const message = JSON.stringify({ type, action, id });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
```

**Event types**:
- `{type: 'node', action: 'added', id: 'nodes:123'}`
- `{type: 'link', action: 'updated', id: 'links:456'}`
- `{type: 'node', action: 'deleted', id: 'nodes:789'}`

---

## db-service.js - Database Layer

**Purpose**: SurrealDB client wrapper with CRUD operations

### Connection Management

```javascript
const Surreal = require('surrealdb.js');
const db = new Surreal();

async function connect() {
  await db.connect('http://127.0.0.1:8000/rpc');
  await db.use({ namespace: 'graphtool', database: 'graphtool' });
  await db.signin({ username: 'root', password: 'root' });
}
```

### Node Operations

**Create**:
```javascript
async function createNode(data) {
  const id = generateId('nodes');
  const result = await db.query(`CREATE ${id} SET
    label = $label,
    url = $url,
    x = $x,
    y = $y,
    created_at = $created_at`, {...data, created_at: new Date().toISOString()});

  const node = result[0]?.[0];

  // Persist to file asynchronously
  fileService.saveNode(node).catch(err => {
    console.error('Failed to persist node to file:', err);
  });

  return node;
}
```

**Delete with Cascade**:
```javascript
async function deleteNode(id) {
  // 1. Fetch connected links BEFORE deleting
  const linksResult = await db.query(
    'SELECT * FROM links WHERE source_id = $id OR target_id = $id',
    { id }
  );
  const connectedLinks = linksResult[0] || [];

  // 2. Delete from database
  await db.query('DELETE FROM links WHERE source_id = $id OR target_id = $id', { id });
  await db.query(`DELETE ${id}`);

  // 3. Delete node file
  fileService.deleteNodeFile(id).catch(err => {...});

  // 4. Delete all connected link files
  for (const link of connectedLinks) {
    fileService.deleteLinkFile(link.id).catch(err => {...});
  }

  return { success: true, id, deletedLinks: connectedLinks.length };
}
```

### File Watcher Integration

**Upsert from file** (called when external file change detected):
```javascript
async function upsertFromFile(data) {
  // Update database WITHOUT writing back to file (prevent loop)
  await db.query(`UPSERT ${data.id} SET
    label = $label,
    url = $url,
    x = $x,
    y = $y,
    created_at = $created_at,
    updated_at = $updated_at`, data);
}
```

---

## file-service.js - File Persistence Layer

**Purpose**: Atomic file I/O, file watching, and write-loop prevention

### Atomic Write Pattern

```javascript
async function atomicWrite(filepath, content) {
  const tempPath = filepath + '.tmp';
  const backupPath = filepath + '.backup';

  try {
    // 1. Write to temp file
    await fs.writeFile(tempPath, content, 'utf8');

    // 2. Backup existing file
    try {
      await fs.rename(filepath, backupPath);
    } catch (err) {
      // File doesn't exist yet
    }

    // 3. Atomic rename (OS-level)
    await fs.rename(tempPath, filepath);

    // 4. Delete backup
    await fs.unlink(backupPath).catch(() => {});
  } catch (err) {
    // Rollback: restore backup
    await fs.rename(backupPath, filepath).catch(() => {});
    throw err;
  }
}
```

**Why atomic?** Prevents file corruption if write is interrupted (crash, power loss, etc.)

### File Watching with Chokidar

```javascript
const chokidar = require('chokidar');

function startWatchers() {
  nodesWatcher = chokidar.watch(NODES_DIR, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,  // Wait 500ms after last change
      pollInterval: 100
    },
    ignored: ['**/*.tmp', '**/*.backup']
  });

  nodesWatcher
    .on('add', filepath => handleFileAdded('node', filepath))
    .on('change', filepath => handleFileChanged('node', filepath))
    .on('unlink', filepath => handleFileDeleted('node', filepath));
}
```

### Write Loop Prevention

**Problem**: File watcher detects our own writes → triggers database update → writes file again → infinite loop

**Solution**: Track recent writes with timestamps

```javascript
const recentWrites = new Map(); // filepath -> timestamp

async function saveNode(node) {
  const filepath = getNodeFilePath(node.id);

  // Mark this write as ours BEFORE writing
  recentWrites.set(filepath, Date.now());

  await atomicWrite(filepath, JSON.stringify(node, null, 2));

  // Clean up after 2 seconds
  setTimeout(() => recentWrites.delete(filepath), 2000);
}

function isOurWrite(filepath) {
  const timestamp = recentWrites.get(filepath);
  if (!timestamp) return false;

  // Consider it our write if within last 1 second
  return (Date.now() - timestamp) < 1000;
}

async function handleFileChanged(type, filepath) {
  if (isOurWrite(filepath)) {
    console.log(`[FileWatcher] Skipping own write: ${filepath}`);
    return;
  }

  // External change detected - update database
  const content = await fs.readFile(filepath, 'utf8');
  const data = JSON.parse(content);
  await dbService.upsertFromFile(data);

  // Notify clients
  global.broadcastDataChange(type, 'updated', data.id);
}
```

### File Naming Convention

**Format**: `{table}_{id-suffix}.json`

**Extraction function**:
```javascript
function getIdSuffix(id) {
  // Handle SurrealDB v2 object format: {tb: 'nodes', id: {String: 'abc123'}}
  const idStr = typeof id === 'string' ? id : `${id.tb}:${id.id.String}`;
  return idStr.split(':')[1];  // "nodes:abc123" → "abc123"
}

function getNodeFilename(id) {
  return `node_${getIdSuffix(id)}.json`;
}
```

---

## data-source-service.js - Multi-Source Management

**Purpose**: Manage multiple data directories with hot reload capability

### Configuration File

**Location**: `data-sources.json` (project root)

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
      "description": "Backup on external drive"
    }
  }
}
```

### Hot Reload Process

```javascript
async function switchSource(newSourceId) {
  const config = await getConfig();
  const newSource = config.sources[newSourceId];

  // 1. Validate new source path
  const validation = await validateSourcePath(newSource.path);
  if (!validation.valid) {
    throw new Error(`Cannot switch: ${validation.error}`);
  }

  // 2. Stop file watchers
  fileService.stopWatchers();

  // 3. Clear SurrealDB cache
  await dbService.clearAllData();

  // 4. Update file service paths
  fileService.updateDataSourcePaths(newSource.path);

  // 5. Ensure new directories exist
  await fileService.ensureDirectories();

  // 6. Load files from new source
  const { nodes, links } = await fileService.loadAllFiles();
  await dbService.populateFromFiles(nodes, links);

  // 7. Restart file watchers on new path
  await fileService.reloadWatchers();

  // 8. Update current source in config
  config.current = newSourceId;
  await saveConfig(config);

  // 9. Broadcast to all clients
  global.broadcastDataChange('source', 'switched', newSourceId);

  return newSource;
}
```

**No server restart required!** All operations happen live.

### Path Validation

```javascript
async function validateSourcePath(sourcePath) {
  const absolutePath = path.resolve(__dirname, sourcePath);
  const nodesDir = path.join(absolutePath, 'nodes');
  const linksDir = path.join(absolutePath, 'links');

  try {
    // Create directories if they don't exist
    await fs.mkdir(nodesDir, { recursive: true });
    await fs.mkdir(linksDir, { recursive: true });

    // Verify main directory is actually a directory
    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      return { valid: false, error: 'Path exists but is not a directory' };
    }

    return { valid: true, absolutePath, nodesDir, linksDir };
  } catch (error) {
    return { valid: false, error: `Failed to access: ${error.message}` };
  }
}
```

---

## Error Handling

### Graceful Degradation

**File loading errors**:
```javascript
async function loadAllFiles() {
  const nodes = [];
  const links = [];
  const errors = [];

  const nodeFiles = await fs.readdir(NODES_DIR);
  for (const filename of nodeFiles) {
    try {
      const content = await fs.readFile(filepath, 'utf8');
      const node = JSON.parse(content);

      // Validate required fields
      if (!node.id || !node.label) {
        throw new Error('Missing required fields');
      }

      nodes.push(node);
    } catch (err) {
      // Log error but continue loading other files
      errors.push({
        file: filepath,
        message: err.message,
        action: 'skipped'
      });
    }
  }

  return { nodes, links, errors };
}
```

**Application remains operational** even with corrupt files. Errors are logged, valid files are loaded.

### Logging Strategy

**Prefix-based logging**:
```javascript
console.log('[FileWatcher] External file added: node_abc123.json');
console.log('[DataSource] Switching from "default" to "external"');
console.error('[FileService] Failed to persist node to file:', err);
```

**Prefixes**: `[SurrealDB]`, `[FileWatcher]`, `[FileService]`, `[DataSource]`, `[WebSocket]`

---

## Performance Considerations

1. **Async file operations**: Never block HTTP responses waiting for file I/O
   ```javascript
   fileService.saveNode(node).catch(err => console.error('Background save failed:', err));
   ```

2. **SurrealDB in-memory**: Fast queries, no disk I/O during normal operation

3. **File watcher debouncing**: 500ms stability threshold prevents rapid-fire updates

4. **WebSocket broadcast**: Only sends ID, clients fetch full data via API

5. **Cascade deletes**: Single query to find all connected links before deletion

---

## Development Tips

**Monitor file watcher events**:
```javascript
// Add to file-service.js
console.log(`[FileWatcher] Event: ${event} on ${filepath}`);
```

**Test hot reload**:
```bash
# Terminal 1: Run server
npm start

# Terminal 2: Manually edit a file
echo '{"id":"nodes:test","label":"Updated"}' > files/nodes/node_test.json

# Terminal 1: Watch console for file watcher event
```

**Debug WebSocket**:
```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3000');
ws.onmessage = e => console.log('WS:', JSON.parse(e.data));
```

**Inspect SurrealDB directly**:
```bash
surreal sql --endpoint http://127.0.0.1:8000 --namespace graphtool --database graphtool
> SELECT * FROM nodes;
```

---

## Common Patterns

### API Endpoint Pattern

```javascript
app.post('/api/nodes', async (req, res) => {
  try {
    const node = await dbService.createNode(req.body);
    global.broadcastDataChange('node', 'added', node.id);
    res.status(201).json(node);
  } catch (error) {
    console.error('Failed to create node:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Cascade Delete Pattern

1. Fetch dependent records **before** deletion
2. Delete from database
3. Delete files
4. Broadcast to clients

### Hot Reload Pattern

1. Stop watchers
2. Clear cache
3. Update paths
4. Reload data
5. Restart watchers
6. Notify clients

---

## See Also

- **[DATABASE.md](DATABASE.md)** - Schema, API reference, WebSocket events
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design and data flow
- **[MODULES.md](MODULES.md)** - Module API specifications
