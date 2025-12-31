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

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Visit `http://localhost:5173` and start creating your graph!

## Tech Stack

- **Frontend**: React 19
- **Visualization**: D3.js v7 (force simulation)
- **Database**: sql.js (SQLite WASM)
- **Storage**: IndexedDB via localforage
- **Build Tool**: Vite 7

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
- **Modules A & B**: Fully standalone, no dependencies
- **Module D**: Integrates all modules (orchestration layer)
- **Modules C & E**: Depend on Module D for state

See [MODULES.md](./docs/MODULES.md) for detailed module specifications.

## Development

See [SETUP.md](./docs/SETUP.md) for complete development environment setup.

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Browser Support

- Chrome/Edge 57+
- Firefox 52+
- Safari 11+

Requires WebAssembly and IndexedDB support.

## License

MIT
