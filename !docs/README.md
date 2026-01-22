# GraphTool - Interactive Network Diagram Tool

## Purpose
Browser-based interactive graph visualization tool for creating and managing semantic networks. Users can visually explore relationships between concepts through an intuitive node-edge interface.

## Core Features
- **Interactive Graph Creation**: Add/remove nodes and links dynamically
- **Hyperlink Attachment**: Attach external URLs to nodes
- **Force-Directed Layout**: Automatic positioning using physics simulation
- **Persistent Storage**: All data saved to local SQLite database
- **Visual Exploration**: Select and inspect graph elements
- **Data Export/Import**: Download and share graph databases

## Tech Stack
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React | UI rendering and React components |
| Physics Engine | D3.js | Force simulation for graph layout |
| Database | sql.js (SQLite WASM) | Client-side data persistence |
| Build Tool | Vite | Fast development and optimized builds |
| Language | JavaScript | Implementation language |

## Use Cases
- Knowledge graphs and concept mapping
- Research note linking (Zettelkasten-style)
- Project dependency visualization
- Mind mapping and brainstorming
- Network analysis and relationship mapping

## Quick Start
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure
```
graphtool_0.1/
├── docs/               # Documentation
├── src/
│   ├── database/       # SQLite data layer
│   ├── engine/         # D3.js force simulation
│   ├── components/     # React UI components
│   ├── store/          # State management
│   └── styles/         # CSS styling
└── package.json
```

## Documentation Index
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and data flow
- [DATABASE.md](./DATABASE.md) - Schema and persistence strategy
- [MODULES.md](./MODULES.md) - Module breakdown and hierarchy
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Development guide and roadmap

## Design Philosophy
1. **Minimal UI**: Canvas-first design with contextual controls
2. **Separation of Concerns**: D3 for physics, React for rendering
3. **Client-Side First**: No server required, runs entirely in browser
4. **Data Ownership**: User data stored locally, full export capability

## Browser Compatibility
- Modern browsers with WebAssembly support
- Chrome/Link 57+, Firefox 52+, Safari 11+
- IndexedDB support required for persistence
