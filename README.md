# GraphTool

Interactive network diagram tool for visualizing semantic graphs in the browser.

## Overview

GraphTool is a browser-based application that lets you create, visualize, and explore node-edge graphs using force-directed layout. Perfect for knowledge graphs, mind mapping, and relationship visualization.

**Key Features:**
- 🎨 Interactive force-directed graph visualization
- 💾 Client-side SQLite database (no server required)
- 🔗 Attach hyperlinks to nodes
- 💫 Smooth physics simulation with D3.js
- 📦 Export/import graph data
- ⚡ Fast development with Vite

## Quick Start

### Prerequisites
Install SurrealDB on your system:
```bash
# macOS
brew install surrealdb/tap/surreal

# Linux
curl -sSf https://install.surrealdb.com | sh

# Windows
iwr https://install.surrealdb.com -useb | iex
```

### Running GraphTool

```bash
# Install dependencies
npm install

# Option 1: Start backend server (recommended)
npm start
# Opens http://localhost:3000 (serves both API + frontend)

# Option 2: Development mode (frontend only)
npm run dev
# Note: Requires backend running separately via `npm run dev:server`
```

### Testing the API
```bash
# Create a node
curl -X POST http://localhost:3000/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"label":"Test Node","url":"https://example.com"}'

# Get all nodes
curl http://localhost:3000/api/nodes
```

## Tech Stack

- **Frontend**: React 19 + Vite 7
- **Visualization**: D3.js v7 (force simulation)
- **Backend**: Node.js + Express 5
- **Database**: SurrealDB 1.3+ (multi-model document database)
- **Architecture**: Client-Server (REST API)

## Documentation

- **[Quick Start Guide](./docs/QUICKSTART.md)** - Get running in 5 minutes
- **[Setup Guide](./docs/SETUP.md)** - Development environment configuration
- **[Architecture](./docs/ARCHITECTURE.md)** - System design and data flow
- **[Modules](./docs/MODULES.md)** - Module breakdown and APIs
- **[Implementation](./docs/IMPLEMENTATION.md)** - Development phases and patterns
- **[Database](./docs/DATABASE.md)** - Schema and persistence

## Project Structure

GraphTool uses a **modular architecture** with clear separation of concerns. Each module (A-E) can be developed and tested independently:

```
graphtool_0.1/
├── src/
│   ├── database/       # Module A: Persistence (standalone)
│   ├── engine/         # Module B: Physics (standalone)
│   ├── components/     # Module C: Visualization (uses Module D)
│   ├── components/ui/  # Module E: UI Shell (uses Module D)
│   ├── store/          # Module D: State orchestration (integrates A, B, C, E)
│   └── utils/          # Helper functions
├── docs/               # Comprehensive documentation
└── public/             # Static assets
```

**Module Dependencies**:
- **Module A (Database)**: Backend is standalone, frontend consumes via HTTP REST API
- **Module B (Physics)**: Fully standalone (client-side D3.js)
- **Module D (State)**: Integrates all modules (orchestration layer)
- **Modules C & E**: Depend on Module D for state

**Architecture**: Client-Server
- Backend exposes `/api/nodes` and `/api/links` endpoints
- Frontend React app consumes REST API
- SurrealDB runs as child process managed by backend

See [MODULES.md](./docs/MODULES.md) for detailed module specifications.

## Development

See [SETUP.md](./docs/SETUP.md) for complete development environment setup.

```bash
# Frontend development
npm run dev         # Vite dev server (port 5173)

# Backend development
npm run dev:server  # Start Express + SurrealDB server (port 3000)

# Production
npm run build       # Build frontend to /dist
npm start           # Start production server (serves /dist + API)

# Code quality
npm run lint        # Run ESLint
```

## System Requirements

**Backend**:
- Node.js 18+
- SurrealDB 1.3+ (installed globally)

**Frontend** (Browser):
- Chrome/Link 90+
- Firefox 88+
- Safari 14+

**Storage**: File-based (data persists to `data/graphtool.db/`)

## License

MIT
