const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const http = require('http');
const WebSocket = require('ws');
const dbService = require('./services/db-service');
const fileService = require('./services/file-service');
const dataSourceService = require('./services/data-source-service');
const config = require('./utils/config');
const eventEmitter = require('./utils/events');

// Configuration
const PORT = config.PORT;
const DB_HOST = config.DB_HOST;
const DB_PORT = config.DB_PORT;
const DB_USER = config.DB_USER;
const DB_PASS = config.DB_PASS;
const DB_PATH = path.join(config.DATA_DIR, 'graphtool.db');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected WebSocket clients
const wsClients = new Set();

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');
  wsClients.add(ws);

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
    wsClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
    wsClients.delete(ws);
  });
});

// Broadcast function to notify all connected clients
function broadcastDataChange(type, action, id) {
  const message = JSON.stringify({ type, action, id });
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Listen for data-change events from services
eventEmitter.on('data-change', (type, action, id) => {
  broadcastDataChange(type, action, id);
});

app.use(express.json());

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static frontend files (Vite build output)
const frontendPath = config.FRONTEND_DIST;
app.use(express.static(frontendPath));

// Store the SurrealDB process reference
let dbProcess = null;

/**
 * Starts the SurrealDB instance as a child process
 */
function startDatabase() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting SurrealDB...');

    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('📁 Created data directory:', dataDir);
    }

    // Spawn SurrealDB process
    dbProcess = spawn('surreal', [
      'start',
      '--bind', `${DB_HOST}:${DB_PORT}`,
      '--user', DB_USER,
      '--pass', DB_PASS,
      `file://${DB_PATH}`
    ]);

    // Handle DB process output
    dbProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[SurrealDB]: ${output.trim()}`);

      // Resolve when DB is ready
      if (output.includes('Started web server')) {
        console.log('✅ SurrealDB is ready!');
        resolve();
      }
    });

    dbProcess.stderr.on('data', (data) => {
      console.error(`[SurrealDB Error]: ${data.toString().trim()}`);
    });

    dbProcess.on('error', (error) => {
      console.error('❌ Failed to start SurrealDB:', error.message);
      reject(error);
    });

    dbProcess.on('close', (code) => {
      console.log(`⚠️  SurrealDB process exited with code ${code}`);
      dbProcess = null;
    });

    // Timeout if DB doesn't start in 10 seconds
    setTimeout(() => {
      if (dbProcess && !dbProcess.killed) {
        reject(new Error('SurrealDB failed to start within timeout'));
      }
    }, 10000);
  });
}

/**
 * Gracefully stops the SurrealDB instance
 */
function stopDatabase() {
  return new Promise((resolve) => {
    if (!dbProcess) {
      console.log('ℹ️  No database process to stop');
      resolve();
      return;
    }

    console.log('🛑 Stopping SurrealDB...');

    dbProcess.on('close', () => {
      console.log('✅ SurrealDB stopped cleanly');
      dbProcess = null;
      resolve();
    });

    // Send termination signal
    dbProcess.kill('SIGTERM');

    // Force kill if not stopped in 5 seconds
    setTimeout(() => {
      if (dbProcess && !dbProcess.killed) {
        console.log('⚠️  Force killing SurrealDB process');
        dbProcess.kill('SIGKILL');
        resolve();
      }
    }, 5000);
  });
}

// ============================================
// API ROUTES - Health & Status
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: dbProcess ? 'running' : 'stopped',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    database: {
      running: dbProcess !== null,
      host: DB_HOST,
      port: DB_PORT,
      path: DB_PATH
    }
  });
});

// ============================================
// API ROUTES - Nodes
// ============================================

app.get('/api/nodes', async (req, res) => {
  try {
    const nodes = await dbService.getAllNodes();
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/nodes/:id', async (req, res) => {
  try {
    const node = await dbService.getNode(req.params.id);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    res.json(node);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/nodes', async (req, res) => {
  try {
    const node = await dbService.createNode(req.body);
    res.status(201).json(node);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/nodes/:id', async (req, res) => {
  try {
    console.log('PUT request for node ID:', req.params.id);
    const node = await dbService.updateNode(req.params.id, req.body);
    res.json(node);
  } catch (error) {
    console.error('PUT error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/nodes/:id', async (req, res) => {
  try {
    console.log('DELETE request for node ID:', req.params.id);
    const result = await dbService.deleteNode(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// API ROUTES - Links
// ============================================

app.get('/api/links', async (req, res) => {
  try {
    const links = await dbService.getAllLinks();
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/links/:id', async (req, res) => {
  try {
    const link = await dbService.getLink(req.params.id);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    res.json(link);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/links', async (req, res) => {
  try {
    const link = await dbService.createLink(req.body);
    res.status(201).json(link);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/links/:id', async (req, res) => {
  try {
    console.log('PUT request for link ID:', req.params.id);
    const link = await dbService.updateLink(req.params.id, req.body);
    res.json(link);
  } catch (error) {
    console.error('PUT error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/links/:id', async (req, res) => {
  try {
    console.log('DELETE request for link ID:', req.params.id);
    const result = await dbService.deleteLink(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all links for a specific node
app.get('/api/nodes/:id/links', async (req, res) => {
  try {
    const links = await dbService.getNodeLinks(req.params.id);
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// API ROUTES - Data Sources
// ============================================

// Get all available data sources
app.get('/api/data-sources', async (req, res) => {
  try {
    const sources = await dataSourceService.getAllSources();
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current active data source
app.get('/api/data-sources/current', async (req, res) => {
  try {
    const current = await dataSourceService.getCurrentSource();
    res.json(current);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Open native directory picker (macOS)
app.get('/api/data-sources/pick-directory', async (req, res) => {
  try {
    const { exec } = require('child_process');

    // Use AppleScript to open native macOS directory picker
    const script = `
      osascript -e 'POSIX path of (choose folder with prompt "Select a parent directory containing data sources:")'
    `;

    exec(script, async (error, stdout, stderr) => {
      if (error) {
        // User cancelled or error occurred
        if (stderr.includes('User canceled')) {
          return res.json({ cancelled: true });
        }
        return res.status(500).json({ error: 'Failed to open directory picker' });
      }

      // Clean up the path (remove trailing newline and whitespace)
      const selectedPath = stdout.trim();

      // Scan for subdirectories
      try {
        const subdirs = [];
        const items = await fsPromises.readdir(selectedPath, { withFileTypes: true });

        for (const item of items) {
          if (item.isDirectory() && !item.name.startsWith('.')) {
            const subdirPath = path.join(selectedPath, item.name);
            subdirs.push({
              name: item.name,
              path: subdirPath
            });
          }
        }

        res.json({
          parentPath: selectedPath,
          subdirectories: subdirs
        });
      } catch (scanError) {
        res.status(500).json({ error: 'Failed to scan directory' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new data source
app.post('/api/data-sources', async (req, res) => {
  try {
    const { id, name, path: sourcePath, description } = req.body;

    if (!id || !name || !sourcePath) {
      return res.status(400).json({ error: 'Missing required fields: id, name, path' });
    }

    const source = await dataSourceService.addSource(id, {
      name,
      path: sourcePath,
      description
    });

    res.status(201).json(source);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Switch to a different data source (triggers hot reload)
app.put('/api/data-sources/current', async (req, res) => {
  try {
    const { sourceId } = req.body;

    if (!sourceId) {
      return res.status(400).json({ error: 'Missing required field: sourceId' });
    }

    // Perform the hot reload
    const result = await performHotReload(sourceId);

    res.json({
      message: 'Data source switched successfully',
      source: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove a data source
app.delete('/api/data-sources/:id', async (req, res) => {
  try {
    await dataSourceService.removeSource(req.params.id);
    res.json({ message: 'Data source removed successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Frontend Routing (SPA support)
// ============================================

// Serve frontend for all other routes (client-side routing)
app.use((req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ============================================
// Hot Reload Functionality
// ============================================

async function performHotReload(newSourceId) {
  console.log(`\n🔄 [Hot Reload] Starting data source switch to: ${newSourceId}`);

  try {
    // 1. Switch data source (validates path and updates config)
    const newSource = await dataSourceService.switchSource(newSourceId);
    console.log(`[Hot Reload] Switched config to: ${newSource.name}`);

    // 2. Stop current file watchers
    fileService.stopWatchers();
    console.log('[Hot Reload] Stopped file watchers');

    // 3. Clear all data from SurrealDB cache
    await dbService.clearAllData();
    console.log('[Hot Reload] Cleared SurrealDB cache');

    // 4. Update file service paths to new source
    fileService.updateDataSourcePaths(newSource.path);

    // 5. Load files from new source
    const { nodes, links, errors } = await fileService.loadAllFiles();
    console.log(`[Hot Reload] Loaded ${nodes.length} nodes, ${links.length} links from new source`);

    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} file(s) had errors (skipped):`);
      errors.forEach(err => console.error(`  - ${err.file}: ${err.message}`));
    }

    // 6. Populate SurrealDB with new data
    await dbService.populateFromFiles(nodes, links);
    console.log('[Hot Reload] SurrealDB cache populated with new data');

    // 7. Restart file watchers on new directory
    await fileService.reloadWatchers();

    // 8. Broadcast reload event to all WebSocket clients
    broadcastDataChange('system', 'reload', newSourceId);
    console.log('[Hot Reload] Broadcasted reload event to clients');

    console.log(`✅ [Hot Reload] Successfully switched to data source: ${newSource.name}\n`);

    return newSource;
  } catch (error) {
    console.error('❌ [Hot Reload] Failed:', error.message);

    // Attempt to recover by reloading current source
    try {
      console.log('[Hot Reload] Attempting to recover with current data source...');
      const currentSource = await dataSourceService.getCurrentSource();
      fileService.updateDataSourcePaths(currentSource.path);
      await fileService.reloadWatchers();
      const { nodes, links } = await fileService.loadAllFiles();
      await dbService.populateFromFiles(nodes, links);
      console.log('[Hot Reload] Recovered with current data source');
    } catch (recoveryError) {
      console.error('[Hot Reload] Recovery failed:', recoveryError.message);
    }

    throw error;
  }
}

// ============================================
// Graceful Shutdown
// ============================================

process.on('SIGTERM', async () => {
  console.log('\n📋 SIGTERM received, shutting down gracefully...');
  fileService.stopWatchers();
  await dbService.disconnect();
  await stopDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n📋 SIGINT received (Ctrl+C), shutting down gracefully...');
  fileService.stopWatchers();
  await dbService.disconnect();
  await stopDatabase();
  process.exit(0);
});

// ============================================
// Application Startup
// ============================================

async function start() {
  try {
    // 1. Ensure directory structure exists
    await fileService.ensureDirectories();

    // 2. Start SurrealDB process (empty cache)
    await startDatabase();

    // 3. Connect to SurrealDB
    await dbService.connect();

    // Set up bidirectional reference for file watcher callbacks
    fileService.setDbService(dbService);

    // 4-5. Load files and populate cache
    const { nodes, links, errors } = await fileService.loadAllFiles();
    console.log(`📂 Loaded ${nodes.length} nodes, ${links.length} links from files`);

    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} file(s) had errors (skipped):`);
      errors.forEach(err => console.error(`  - ${err.file}: ${err.message}`));
    }

    await dbService.populateFromFiles(nodes, links);
    console.log('💾 SurrealDB cache populated from files');

    // 6. Start file watchers
    fileService.startWatchers();
    console.log('👀 File watchers active');

    // 7. Start HTTP server (Express + WebSocket)
    server.listen(PORT, () => {
      console.log(`\n🌐 GraphTool server running on http://localhost:${PORT}`);
      console.log(`📊 SurrealDB running on http://${DB_HOST}:${DB_PORT}`);
      console.log(`\n📡 API Endpoints:`);
      console.log(`  Health & Status:`);
      console.log(`    - GET    http://localhost:${PORT}/health`);
      console.log(`    - GET    http://localhost:${PORT}/api/status`);
      console.log(`  Nodes:`);
      console.log(`    - GET    http://localhost:${PORT}/api/nodes`);
      console.log(`    - GET    http://localhost:${PORT}/api/nodes/:id`);
      console.log(`    - POST   http://localhost:${PORT}/api/nodes`);
      console.log(`    - PUT    http://localhost:${PORT}/api/nodes/:id`);
      console.log(`    - DELETE http://localhost:${PORT}/api/nodes/:id`);
      console.log(`  Links:`);
      console.log(`    - GET    http://localhost:${PORT}/api/links`);
      console.log(`    - GET    http://localhost:${PORT}/api/links/:id`);
      console.log(`    - POST   http://localhost:${PORT}/api/links`);
      console.log(`    - PUT    http://localhost:${PORT}/api/links/:id`);
      console.log(`    - DELETE http://localhost:${PORT}/api/links/:id`);
      console.log(`    - GET    http://localhost:${PORT}/api/nodes/:id/links`);
      console.log(`\n💾 Source files: files/nodes/ & files/links/`);
      console.log(`💿 SurrealDB cache: ${DB_PATH}\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// Run the application
start();
