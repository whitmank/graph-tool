# Development Setup

Complete guide to setting up your development environment.

## Prerequisites

### Required
- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **Git** 2.40.0 or higher
- Modern browser with DevTools

### Recommended
- **VS Code** with extensions:
  - ESLint
  - Prettier
  - ES7+ React/Redux/React-Native snippets
- **React DevTools** browser extension
- **Redux DevTools** (future use)

## Initial Setup

### 1. Clone and Install

```bash
cd graphtool_0.1
npm install
```

**Dependencies installed:**
- `react`, `react-dom` - UI framework
- `d3` - Force simulation
- `sql.js` - SQLite WASM
- `localforage` - IndexedDB wrapper

### 2. Environment Configuration

Create `.env.local` for local overrides:

```bash
# Optional: Custom Vite dev server port
VITE_PORT=5173

# Optional: SQL.js CDN override
VITE_SQLJS_CDN=https://sql.js.org/dist/
```

Default configuration in `vite.config.js` works out of the box.

### 3. Verify Setup

```bash
npm run dev
```

Visit http://localhost:5173 - you should see an empty graph canvas.

## Development Workflow

### Git Workflow

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# Create feature branch
git checkout -b feature/add-edge-creation

# After changes
git add .
git commit -m "Add edge creation UI"
```

**Commit Message Format:**
Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code restructuring
- `test:` Adding tests
- `chore:` Maintenance

Example: `feat: add node deletion functionality`

### Code Style

**ESLint** is pre-configured. Run:
```bash
npm run lint
```

**Auto-fix issues:**
```bash
npm run lint -- --fix
```

### Recommended: Add Prettier

```bash
npm install -D prettier
```

Create `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

Format code:
```bash
npx prettier --write "src/**/*.{js,jsx,css}"
```

### Browser DevTools

**Essential tools:**

1. **React DevTools**
   - Inspect component hierarchy
   - View props/state in real-time
   - Profile rendering performance

2. **Application Tab**
   - Check IndexedDB for `graphtool_db`
   - Monitor storage usage
   - Clear data when testing

3. **Console**
   - Enable verbose logging in development
   - Check for D3 simulation warnings
   - Monitor database operations

4. **Network Tab**
   - Verify sql.js WASM loads (~1.5MB)
   - Check for 404s on assets

## Project Structure

```
src/
├── database/
│   ├── db.js              # Database initialization
│   ├── schema.js          # Table definitions (future)
│   └── queries.js         # CRUD operations (future)
├── engine/
│   ├── forceSimulation.js # D3 force setup (future)
│   └── simulationControls.js
├── components/
│   ├── GraphCanvas.jsx    # Main canvas
│   ├── Node.jsx           # Node component
│   ├── Edge.jsx           # Edge component
│   └── ui/
│       ├── App.jsx        # Root component
│       └── Toolbar.jsx    # Controls
├── store/
│   ├── GraphContext.jsx   # Context provider (future)
│   └── graphReducer.js    # State reducer (future)
└── main.jsx               # Entry point
```

## Development Commands

```bash
# Start dev server with HMR
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run linter
npm run lint

# Fix linting issues
npm run lint -- --fix
```

## Module Development Order

Follow this order for coherent development:

1. **Database module** (`src/database/`)
2. **State management** (`src/store/`)
3. **Engine module** (`src/engine/`)
4. **React components** (`src/components/`)
5. **UI shell** (`src/components/ui/`)

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for detailed phases.

## Debugging Tips

### Database Issues
```javascript
// In browser console
localforage.getItem('graphtool_db').then(console.log);
```

### Force Simulation Not Running
```javascript
// Check simulation status
console.log(simulation.alpha());  // Should be > 0 when running
```

### State Updates Not Reflecting
- Check React DevTools for stale state
- Verify reducer actions dispatching
- Look for missing array spreads ([...nodes])

## Performance Profiling

**React Rendering:**
```bash
# Use React DevTools Profiler tab
1. Start recording
2. Interact with graph
3. Stop and analyze flame graph
```

**D3 Simulation:**
```javascript
// Add to forceSimulation.js
simulation.on("tick", () => {
  console.time("tick");
  // ... your code
  console.timeEnd("tick");
});
```

## Common Issues

**"Cannot find module 'sql.js'"**
- Run `npm install` again
- Check `node_modules/sql.js` exists

**HMR not working**
- Restart dev server
- Clear browser cache
- Check Vite console for errors

**Database resets on refresh**
- Verify `saveDatabase()` is called after mutations
- Check browser IndexedDB storage not full
- Look for errors in console during save

**Port already in use**
- Change port in `vite.config.js`:
```javascript
export default {
  server: { port: 3000 }
}
```

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand system design
- Follow [IMPLEMENTATION.md](./IMPLEMENTATION.md) to build features
- Reference [MODULES.md](./MODULES.md) for API specifications
