const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const config = require('../utils/config');
const eventEmitter = require('../utils/events');

// Configuration - Now mutable to support hot reload
let FILES_DIR = config.FILES_DIR;
let NODES_DIR = path.join(FILES_DIR, 'nodes');
let LINKS_DIR = path.join(FILES_DIR, 'links');

// Track our own writes to prevent reload loops
const recentWrites = new Map(); // filepath -> timestamp

// File watcher instances
let nodesWatcher = null;
let linksWatcher = null;
let dbService = null; // Will be set by setDbService()

// Set database service reference (for file watcher callbacks)
function setDbService(service) {
  dbService = service;
}

// Ensure directory structure exists
async function ensureDirectories() {
  await fs.mkdir(NODES_DIR, { recursive: true });
  await fs.mkdir(LINKS_DIR, { recursive: true });
  console.log('📁 Directory structure verified');
}

// Utility: Convert SurrealDB ID to string format
function idToString(id) {
  if (typeof id === 'string') {
    return id;
  } else if (typeof id === 'object' && id !== null && id.tb) {
    // SurrealDB v2+ object format: {tb: 'nodes', id: {...}}
    const table = id.tb;
    const idPart = id.id;
    const idStr = typeof idPart === 'object' && idPart.String ? idPart.String : String(idPart);
    return `${table}:${idStr}`;
  }
  return String(id);
}

// Utility: Extract ID suffix from SurrealDB ID
function getIdSuffix(id) {
  // First normalize to string
  const idStr = idToString(id);
  // Convert "nodes:abc123" -> "abc123"
  return idStr.split(':')[1];
}

// Utility: Get filename from ID
function getNodeFilename(id) {
  const suffix = getIdSuffix(id);
  return `node_${suffix}.json`;
}

function getLinkFilename(id) {
  const suffix = getIdSuffix(id);
  return `link_${suffix}.json`;
}

// Utility: Get full file path
function getNodeFilePath(id) {
  return path.join(NODES_DIR, getNodeFilename(id));
}

function getLinkFilePath(id) {
  return path.join(LINKS_DIR, getLinkFilename(id));
}

// Utility: Extract ID from filename
function extractIdFromFilename(filename, table) {
  // Extract "abc123" from "node_abc123.json" or "link_abc123.json" (backwards compatible with edges)
  const match = filename.match(/^(?:nodes?|links?|edges?)_(.+)\.json$/);
  if (!match) return null;
  return `${table}:${match[1]}`;
}

// Check if a filepath was recently written by us
function isOurWrite(filepath) {
  const timestamp = recentWrites.get(filepath);
  if (!timestamp) return false;

  // Consider it our write if within last 1 second
  return (Date.now() - timestamp) < 1000;
}

// Atomic write implementation
async function atomicWrite(filepath, content) {
  const tempPath = filepath + '.tmp';
  const backupPath = filepath + '.backup';

  try {
    // Write to temp file first
    await fs.writeFile(tempPath, content, 'utf8');

    // Create backup of existing file (if exists)
    try {
      await fs.rename(filepath, backupPath);
    } catch (err) {
      // File doesn't exist yet, that's ok
    }

    // Atomic rename (OS-level operation)
    await fs.rename(tempPath, filepath);

    // Delete backup on success
    try {
      await fs.unlink(backupPath);
    } catch (err) {
      // Ignore - backup cleanup failure is not critical
    }
  } catch (err) {
    // Rollback: restore backup if exists
    try {
      await fs.rename(backupPath, filepath);
    } catch (rollbackErr) {
      // Nothing to restore
    }
    throw err; // Re-throw original error
  }
}

// Save node to file
async function saveNode(node) {
  const filepath = getNodeFilePath(node.id);

  // Mark this write as ours BEFORE writing
  recentWrites.set(filepath, Date.now());

  // Normalize ID to string format for JSON storage
  const normalizedNode = {
    ...node,
    id: idToString(node.id)
  };

  const content = JSON.stringify(normalizedNode, null, 2);
  await atomicWrite(filepath, content);

  // Clean up after 2 seconds
  setTimeout(() => recentWrites.delete(filepath), 2000);
}

// Save link to file
async function saveLink(link) {
  const filepath = getLinkFilePath(link.id);

  // Mark this write as ours BEFORE writing
  recentWrites.set(filepath, Date.now());

  // Normalize IDs to string format for JSON storage
  const normalizedLink = {
    ...link,
    id: idToString(link.id),
    source_id: idToString(link.source_id),
    target_id: idToString(link.target_id)
  };

  const content = JSON.stringify(normalizedLink, null, 2);
  await atomicWrite(filepath, content);

  // Clean up after 2 seconds
  setTimeout(() => recentWrites.delete(filepath), 2000);
}

// Delete node file
async function deleteNodeFile(id) {
  const filepath = getNodeFilePath(id);

  try {
    // Mark as our write to prevent watcher from triggering
    recentWrites.set(filepath, Date.now());
    await fs.unlink(filepath);
    setTimeout(() => recentWrites.delete(filepath), 2000);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Ignore "file not found" errors, throw others
      throw err;
    }
  }
}

// Delete link file
async function deleteLinkFile(id) {
  const filepath = getLinkFilePath(id);

  try {
    // Mark as our write to prevent watcher from triggering
    recentWrites.set(filepath, Date.now());
    await fs.unlink(filepath);
    setTimeout(() => recentWrites.delete(filepath), 2000);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

// Load all files on startup
async function loadAllFiles() {
  const nodes = [];
  const links = [];
  const errors = [];

  // Load nodes
  try {
    const nodeFiles = await fs.readdir(NODES_DIR);

    for (const filename of nodeFiles) {
      if (!filename.endsWith('.json')) continue;
      if (filename.endsWith('.tmp') || filename.endsWith('.backup')) continue;

      const filepath = path.join(NODES_DIR, filename);
      try {
        const content = await fs.readFile(filepath, 'utf8');
        const node = JSON.parse(content);

        // Validate required fields
        if (!node.id || !node.label) {
          throw new Error('Missing required fields: id or label');
        }

        nodes.push(node);
      } catch (err) {
        errors.push({
          file: filepath,
          message: err.message,
          action: 'skipped'
        });
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Failed to read nodes directory:', err);
    }
  }

  // Load links
  try {
    const linkFiles = await fs.readdir(LINKS_DIR);

    for (const filename of linkFiles) {
      if (!filename.endsWith('.json')) continue;
      if (filename.endsWith('.tmp') || filename.endsWith('.backup')) continue;

      const filepath = path.join(LINKS_DIR, filename);
      try {
        const content = await fs.readFile(filepath, 'utf8');
        const link = JSON.parse(content);

        // Validate required fields
        if (!link.id || !link.source_id || !link.target_id) {
          throw new Error('Missing required fields: id, source_id, or target_id');
        }

        links.push(link);
      } catch (err) {
        errors.push({
          file: filepath,
          message: err.message,
          action: 'skipped'
        });
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Failed to read links directory:', err);
    }
  }

  return { nodes, links, errors };
}

// File watcher event handlers
async function handleFileAdded(type, filepath) {
  const filename = path.basename(filepath);

  // Only process JSON files
  if (!filename.endsWith('.json')) return;

  // Skip if this was our own write
  if (isOurWrite(filepath)) {
    console.log(`[FileWatcher] Skipping own write: ${filename}`);
    return;
  }

  console.log(`[FileWatcher] External file added: ${filename}`);

  try {
    const content = await fs.readFile(filepath, 'utf8');
    const data = JSON.parse(content);

    if (dbService) {
      if (type === 'node') {
        await dbService.upsertFromFile(data);
      } else {
        await dbService.upsertFromFile(data);
      }
      console.log(`[FileWatcher] Created ${type} in cache: ${data.id}`);

      // Notify connected clients
      eventEmitter.emit('data-change', type, 'added', data.id);
    }
  } catch (err) {
    console.error(`[FileWatcher] Failed to sync ${filepath}:`, err.message);
  }
}

async function handleFileChanged(type, filepath) {
  const filename = path.basename(filepath);

  // Only process JSON files
  if (!filename.endsWith('.json')) return;

  // Skip if this was our own write
  if (isOurWrite(filepath)) {
    console.log(`[FileWatcher] Skipping own write: ${filename}`);
    return;
  }

  console.log(`[FileWatcher] External edit detected: ${filename}`);

  try {
    const content = await fs.readFile(filepath, 'utf8');
    const data = JSON.parse(content);

    if (dbService) {
      await dbService.upsertFromFile(data);
      console.log(`[FileWatcher] Updated ${type} in cache: ${data.id}`);

      // Notify connected clients
      eventEmitter.emit('data-change', type, 'updated', data.id);
    }
  } catch (err) {
    console.error(`[FileWatcher] Failed to sync ${filepath}:`, err.message);
  }
}

async function handleFileDeleted(type, filepath) {
  const filename = path.basename(filepath);

  // Only process JSON files
  if (!filename.endsWith('.json')) return;

  // Skip if this was our own delete
  if (isOurWrite(filepath)) {
    console.log(`[FileWatcher] Skipping own delete: ${filename}`);
    return;
  }

  console.log(`[FileWatcher] External file deleted: ${filename}`);

  try {
    const table = type === 'node' ? 'nodes' : 'links';
    const id = extractIdFromFilename(filename, table);

    if (id && dbService) {
      await dbService.deleteFromFile(id);
      console.log(`[FileWatcher] Deleted ${type} from cache: ${id}`);

      // Notify connected clients
      eventEmitter.emit('data-change', type, 'deleted', id);
    }
  } catch (err) {
    console.error(`[FileWatcher] Failed to delete ${type}:`, err.message);
  }
}

// Start file watchers
function startWatchers() {
  console.log(`[FileWatcher] Starting watchers for:`);
  console.log(`  Nodes: ${NODES_DIR}`);
  console.log(`  Links: ${LINKS_DIR}`);

  // Watch nodes directory
  nodesWatcher = chokidar.watch(NODES_DIR, {
    ignoreInitial: true,
    persistent: true,
    usePolling: false,
    awaitWriteFinish: {
      stabilityThreshold: 500,  // Wait 500ms for writes to finish
      pollInterval: 100
    },
    ignored: [
      '**/*.tmp',
      '**/*.backup',
      '**/*~',
      '**/.*.swp'
    ]
  });

  nodesWatcher
    .on('add', filepath => handleFileAdded('node', filepath))
    .on('change', filepath => handleFileChanged('node', filepath))
    .on('unlink', filepath => handleFileDeleted('node', filepath))
    .on('error', error => console.error('[FileWatcher] Error:', error))
    .on('ready', () => console.log('[FileWatcher] Nodes watcher ready'));

  // Watch links directory
  linksWatcher = chokidar.watch(LINKS_DIR, {
    ignoreInitial: true,
    persistent: true,
    usePolling: false,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    },
    ignored: [
      '**/*.tmp',
      '**/*.backup',
      '**/*~',
      '**/.*.swp'
    ]
  });

  linksWatcher
    .on('add', filepath => handleFileAdded('link', filepath))
    .on('change', filepath => handleFileChanged('link', filepath))
    .on('unlink', filepath => handleFileDeleted('link', filepath))
    .on('error', error => console.error('[FileWatcher] Error:', error))
    .on('ready', () => console.log('[FileWatcher] Links watcher ready'));
}

// Stop file watchers
function stopWatchers() {
  if (nodesWatcher) {
    nodesWatcher.close();
    nodesWatcher = null;
  }
  if (linksWatcher) {
    linksWatcher.close();
    linksWatcher = null;
  }
  console.log('File watchers stopped');
}

// Update data source paths (for hot reload)
function updateDataSourcePaths(newSourcePath) {
  // Resolve path relative to project root
  const resolvedPath = path.resolve(__dirname, newSourcePath);

  // Update module-level variables
  FILES_DIR = resolvedPath;
  NODES_DIR = path.join(FILES_DIR, 'nodes');
  LINKS_DIR = path.join(FILES_DIR, 'links');

  console.log(`[FileService] Updated data source paths:`);
  console.log(`  Files: ${FILES_DIR}`);
  console.log(`  Nodes: ${NODES_DIR}`);
  console.log(`  Links: ${LINKS_DIR}`);
}

// Get current data source paths
function getCurrentPaths() {
  return {
    filesDir: FILES_DIR,
    nodesDir: NODES_DIR,
    linksDir: LINKS_DIR
  };
}

// Reload file watchers with new paths
async function reloadWatchers() {
  console.log('[FileService] Reloading file watchers...');

  // Stop existing watchers
  stopWatchers();

  // Clear recent writes tracking
  recentWrites.clear();

  // Ensure new directories exist
  await ensureDirectories();

  // Start watchers on new directories
  startWatchers();

  console.log('[FileService] File watchers reloaded successfully');
}

module.exports = {
  setDbService,
  ensureDirectories,
  saveNode,
  saveLink,
  deleteNodeFile,
  deleteLinkFile,
  loadAllFiles,
  startWatchers,
  stopWatchers,
  reloadWatchers,
  updateDataSourcePaths,
  getCurrentPaths,
  isOurWrite
};
