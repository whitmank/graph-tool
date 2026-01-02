# GraphTool Backend

Express server with SurrealDB cache and file-based persistence for graph data.

## Tech Stack

- **Node.js** - Runtime
- **Express 5** - HTTP server and REST API
- **SurrealDB 1.3+** - In-memory graph cache
- **WebSocket (ws)** - Real-time updates
- **Chokidar** - File system watching

## Development

```bash
# Install dependencies
npm install

# Start server (spawns SurrealDB, starts Express)
npm start

# Development mode
npm run dev
```

## Prerequisites

SurrealDB must be installed:

```bash
# macOS
brew install surrealdb/tap/surreal

# Linux
curl -sSf https://install.surrealdb.com | sh

# Windows
iwr https://install.surrealdb.com -useb | iex
```

## Project Structure

```
src/
├── server.js                    # Express server, WebSocket, SurrealDB spawner
├── services/                    # Business logic
│   ├── db-service.js            # SurrealDB CRUD operations
│   ├── file-service.js          # File I/O and watchers
│   └── data-source-service.js   # Multi-source management
├── utils/                       # Utilities
│   ├── events.js                # EventEmitter for broadcasts
│   └── config.js                # Configuration constants
└── types/                       # JSDoc type definitions
    ├── node.js
    └── link.js
```

## Architecture

**Data Flow**:
1. Files are the source of truth (JSON in `../../files/`)
2. SurrealDB is an ephemeral cache (rebuilt on startup)
3. File watchers sync external changes to cache
4. WebSocket broadcasts updates to clients

## API Endpoints

### Nodes
- `GET /api/nodes` - Get all nodes
- `GET /api/nodes/:id` - Get single node
- `POST /api/nodes` - Create node
- `PUT /api/nodes/:id` - Update node
- `DELETE /api/nodes/:id` - Delete node (cascade)

### Links
- `GET /api/links` - Get all links
- `POST /api/links` - Create link
- `PUT /api/links/:id` - Update link
- `DELETE /api/links/:id` - Delete link
- `GET /api/nodes/:id/links` - Get node's links

### Data Sources
- `GET /api/data-sources` - List all sources
- `GET /api/data-sources/current` - Get active source
- `POST /api/data-sources` - Add new source
- `PUT /api/data-sources/current` - Switch source (hot reload)
- `DELETE /api/data-sources/:id` - Remove source

### Status
- `GET /health` - Health check
- `GET /api/status` - Server status

## Configuration

Environment variables (optional):
- `PORT` - Server port (default: 3000)
- `DB_HOST` - SurrealDB host (default: 127.0.0.1)
- `DB_PORT` - SurrealDB port (default: 8000)
- `DB_USER` - SurrealDB user (default: root)
- `DB_PASS` - SurrealDB password (default: root)

## Data Storage

- **Source files**: `../../files/nodes/` and `../../files/links/`
- **SurrealDB cache**: `../../data/graphtool.db/`
- **Config**: `../../data-sources.json`
