# Quick Start Guide

Get GraphTool running in 5 minutes.

## Prerequisites

- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Installation

```bash
# Clone or navigate to project directory
cd graphtool_0.1

# Install dependencies
npm install

# Start server (backend + frontend)
npm start
```

Server starts on http://localhost:3000
Developer interface: http://localhost:3000/dev

## Your First Graph

### 1. Add a Node
- Type a label in the toolbar input (e.g., "React")
- Click "Add Node"
- The node appears and starts positioning itself

### 2. Add More Nodes
- Add a few more: "D3.js", "SurrealDB", "Vite"
- View your nodes in the Developer Interface

### 3. Add a Link (Connection)
- Go to http://localhost:3000/dev
- Click "Links" tab
- Select source and target nodes, click "Add Link"

### 4. Interact
- **Drag**: Click and drag any node to reposition
- **Zoom**: Scroll to zoom in/out
- **Pan**: Click and drag on empty canvas
- **Select**: Click a node to highlight it

### 5. Data Persistence
- All data saved to JSON files in `files/` directory
- Check `files/nodes/` and `files/links/` for your graph data
- Files are human-readable and git-friendly

## What's Happening Under the Hood

1. **Express server** handles HTTP and WebSocket connections
2. **SurrealDB** provides fast in-memory query cache
3. **File service** saves data to JSON files (source of truth)
4. **File watcher** detects external file changes
5. **WebSocket** broadcasts real-time updates to all clients

## Next Steps

- **[Setup Development Environment](./SETUP.md)** - Configure tooling
- **[Architecture Overview](./ARCHITECTURE.md)** - Understand the system
- **[Implementation Guide](./IMPLEMENTATION.md)** - Build features

## Troubleshooting

**Server won't start?**
- Check if SurrealDB is installed: `surreal version`
- Install it: `brew install surrealdb/tap/surreal` (macOS)
- Check if port 3000 is already in use

**Nodes/links don't appear?**
- Check `files/nodes/` and `files/links/` directories exist
- Verify JSON files are valid format
- Check server console for file loading errors

**Changes not persisting?**
- Check file permissions on `files/` directory
- Verify disk space available
- Check server console for file write errors

**Can't switch data sources?**
- Verify target directory path exists
- Check `data-sources.json` is valid JSON
- Ensure target directory has `nodes/` and `links/` subdirectories
