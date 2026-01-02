# GraphTool Frontend

React-based interactive graph visualization frontend using D3.js force simulation.

## Tech Stack

- **React 19** - UI framework
- **Vite 7** - Build tool and dev server
- **D3.js v7** - Force simulation engine
- **React Router** - Client-side routing

## Development

```bash
# Install dependencies
npm install

# Start dev server (requires backend running on port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Project Structure

```
src/
├── components/          # React components
│   ├── GraphCanvas.jsx  # Main graph visualization
│   ├── Node.jsx         # Node rendering
│   ├── Link.jsx         # Link rendering
│   └── ui/              # UI controls
├── store/               # State management
│   ├── GraphContext.jsx # Context provider
│   ├── graphReducer.js  # State reducer
│   └── useGraph.js      # Custom hooks
├── engine/              # D3 physics
│   ├── forceSimulation.js
│   └── simulationControls.js
├── DevInterface.jsx     # Developer CRUD interface
└── main.jsx             # Application entry point
```

## API Connection

The frontend connects to the backend API at `http://localhost:3000/api` via Vite proxy configuration.

WebSocket connection for real-time updates: `ws://localhost:3000`

## Routes

- `/` - Main graph visualization
- `/dev` - Developer CRUD interface
