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

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Your First Graph

### 1. Add a Node
- Type a label in the toolbar input (e.g., "React")
- Click "Add Node"
- The node appears and starts positioning itself

### 2. Add More Nodes
- Add a few more: "D3.js", "SQLite", "Vite"
- Nodes automatically repel and space themselves

### 3. Add an Edge (Connection)
Future implementation - currently nodes-only

### 4. Interact
- **Drag**: Click and drag any node to reposition
- **Zoom**: Scroll to zoom in/out
- **Pan**: Click and drag on empty canvas
- **Select**: Click a node to highlight it

### 5. Data Persistence
- Refresh the page - your graph persists!
- Data is stored in browser IndexedDB automatically

## What's Happening Under the Hood

1. **D3.js** calculates physics forces
2. **React** renders SVG elements
3. **sql.js** stores data in SQLite (in-memory)
4. **localforage** persists database to IndexedDB

## Next Steps

- **[Setup Development Environment](./SETUP.md)** - Configure tooling
- **[Architecture Overview](./ARCHITECTURE.md)** - Understand the system
- **[Implementation Guide](./IMPLEMENTATION.md)** - Build features

## Troubleshooting

**Nodes don't appear?**
- Check browser console for errors
- Verify database initialized (check Application > IndexedDB in DevTools)

**Simulation not running?**
- Ensure JavaScript is enabled
- Check for WebAssembly support: `typeof WebAssembly !== 'undefined'`

**Changes not persisting?**
- Check IndexedDB quota in DevTools
- Clear site data and reload if corrupted
