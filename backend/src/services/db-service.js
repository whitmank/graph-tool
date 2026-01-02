const { Surreal } = require('surrealdb');
const crypto = require('crypto');
const fileService = require('./file-service');
const config = require('../utils/config');

// Database connection configuration
const DB_CONFIG = {
  host: config.DB_HOST,
  port: config.DB_PORT,
  namespace: 'graphtool',
  database: 'graphtool',
  user: config.DB_USER,
  pass: config.DB_PASS
};

// Create a single database instance
const db = new Surreal();

/**
 * Initialize connection to SurrealDB
 * This should be called after the DB process has started
 */
async function connect() {
  try {
    await db.connect(`http://${DB_CONFIG.host}:${DB_CONFIG.port}/rpc`);
    await db.signin({
      username: DB_CONFIG.user,
      password: DB_CONFIG.pass
    });
    await db.use({
      namespace: DB_CONFIG.namespace,
      database: DB_CONFIG.database
    });
    console.log('✅ Connected to SurrealDB');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to SurrealDB:', error);
    throw error;
  }
}

/**
 * Disconnect from SurrealDB
 */
async function disconnect() {
  try {
    await db.close();
    console.log('✅ Disconnected from SurrealDB');
  } catch (error) {
    console.error('❌ Error disconnecting from SurrealDB:', error);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a unique ID for a table
 */
function generateId(table) {
  const random = crypto.randomBytes(8).toString('hex');
  return `${table}:${random}`;
}

/**
 * Populate SurrealDB from loaded file data (startup)
 */
async function populateFromFiles(nodes, links) {
  try {
    console.log('Populating SurrealDB from files...');

    // Upsert all nodes (files are source of truth)
    for (const node of nodes) {
      await db.query(`UPSERT ${node.id} SET
        label = $label,
        url = $url,
        x = $x,
        y = $y,
        created_at = $created_at,
        updated_at = $updated_at`, {
        label: node.label,
        url: node.url || null,
        x: node.x || null,
        y: node.y || null,
        created_at: node.created_at,
        updated_at: node.updated_at || node.created_at
      });
    }

    // Upsert all links (files are source of truth)
    for (const link of links) {
      await db.query(`UPSERT ${link.id} SET
        source_id = $source_id,
        target_id = $target_id,
        label = $label,
        created_at = $created_at,
        updated_at = $updated_at`, {
        source_id: link.source_id,
        target_id: link.target_id,
        label: link.label || null,
        created_at: link.created_at,
        updated_at: link.updated_at || link.created_at
      });
    }

    console.log(`✅ Populated ${nodes.length} nodes and ${links.length} links`);
  } catch (error) {
    console.error('Error populating from files:', error);
    throw error;
  }
}

/**
 * Upsert (create or update) entity from file change (file watcher)
 */
async function upsertFromFile(data) {
  try {
    // Determine if this is a node or link based on ID prefix
    const table = data.id.split(':')[0];

    if (table === 'nodes') {
      await db.query(`UPSERT ${data.id} SET
        label = $label,
        url = $url,
        x = $x,
        y = $y,
        created_at = $created_at,
        updated_at = $updated_at`, {
        label: data.label,
        url: data.url || null,
        x: data.x || null,
        y: data.y || null,
        created_at: data.created_at,
        updated_at: data.updated_at || new Date().toISOString()
      });
    } else if (table === 'links') {
      await db.query(`UPSERT ${data.id} SET
        source_id = $source_id,
        target_id = $target_id,
        label = $label,
        created_at = $created_at,
        updated_at = $updated_at`, {
        source_id: data.source_id,
        target_id: data.target_id,
        label: data.label || null,
        created_at: data.created_at,
        updated_at: data.updated_at || new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error upserting from file:', error);
    throw error;
  }
}

/**
 * Delete entity from database (triggered by file deletion)
 */
async function deleteFromFile(id) {
  try {
    await db.query(`DELETE ${id}`);
  } catch (error) {
    console.error('Error deleting from file:', error);
    throw error;
  }
}

/**
 * Clear all data from SurrealDB cache (for hot reload)
 */
async function clearAllData() {
  try {
    console.log('[DB] Clearing all data from cache...');

    // Delete all links first (to avoid foreign key issues)
    await db.query('DELETE FROM links');

    // Then delete all nodes
    await db.query('DELETE FROM nodes');

    console.log('[DB] All data cleared from cache');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

// ============================================
// NODE OPERATIONS
// ============================================

/**
 * Get all nodes from the graph
 */
async function getAllNodes() {
  try {
    const result = await db.query('SELECT * FROM nodes ORDER BY label');
    return result[0] || [];
  } catch (error) {
    console.error('Error fetching nodes:', error);
    throw error;
  }
}

/**
 * Get a single node by ID
 */
async function getNode(id) {
  try {
    const result = await db.query(`SELECT * FROM ${id}`);
    return result[0]?.[0] || null;
  } catch (error) {
    console.error('Error fetching node:', error);
    throw error;
  }
}

/**
 * Create a new node
 */
async function createNode(data) {
  try {
    // 1. Pre-generate ID for cleaner transaction ordering
    const id = generateId('nodes');

    // 2. Create in SurrealDB
    const result = await db.query(`CREATE ${id} SET
      label = $label,
      url = $url,
      x = $x,
      y = $y,
      created_at = $created_at`, {
      label: data.label,
      url: data.url || null,
      x: data.x || null,
      y: data.y || null,
      created_at: new Date().toISOString()
    });

    const node = result[0]?.[0];

    // 3. Persist to file (async, non-blocking)
    fileService.saveNode(node).catch(err => {
      console.error('Failed to persist node to file:', err);
    });

    return node;
  } catch (error) {
    console.error('Error creating node:', error);
    throw error;
  }
}

/**
 * Update an existing node
 */
async function updateNode(id, data) {
  try {
    console.log('Updating node:', id, 'with data:', data);

    const updateQuery = `UPDATE ${id} SET
      label = $label,
      url = $url,
      x = $x,
      y = $y,
      updated_at = $updated_at`;

    const result = await db.query(updateQuery, {
      label: data.label,
      url: data.url || null,
      x: data.x,
      y: data.y,
      updated_at: new Date().toISOString()
    });

    console.log('Update result:', result);
    const node = result[0]?.[0] || null;

    // Persist to file
    if (node) {
      fileService.saveNode(node).catch(err => {
        console.error('Failed to persist node update:', err);
      });
    }

    return node;
  } catch (error) {
    console.error('Error updating node:', error);
    throw error;
  }
}

/**
 * Delete a node
 */
async function deleteNode(id) {
  try {
    console.log('Deleting node:', id);

    // 1. Fetch connected links BEFORE deleting
    const linksResult = await db.query(
      'SELECT * FROM links WHERE source_id = $id OR target_id = $id',
      { id }
    );
    const connectedLinks = linksResult[0] || [];

    // 2. Delete from database (cascade)
    await db.query('DELETE FROM links WHERE source_id = $id OR target_id = $id', { id });
    await db.query(`DELETE ${id}`);

    // 3. Delete node file
    fileService.deleteNodeFile(id).catch(err => {
      console.error('Failed to delete node file:', err);
    });

    // 4. Delete all connected link files
    for (const link of connectedLinks) {
      fileService.deleteLinkFile(link.id).catch(err => {
        console.error('Failed to delete link file:', err);
      });
    }

    return { success: true, id, deletedLinks: connectedLinks.length };
  } catch (error) {
    console.error('Error deleting node:', error);
    throw error;
  }
}

// ============================================
// LINK OPERATIONS
// ============================================

/**
 * Get all links from the graph
 */
async function getAllLinks() {
  try {
    const result = await db.query('SELECT * FROM links');
    return result[0] || [];
  } catch (error) {
    console.error('Error fetching links:', error);
    throw error;
  }
}

/**
 * Get a single link by ID
 */
async function getLink(id) {
  try {
    const result = await db.query(`SELECT * FROM ${id}`);
    return result[0]?.[0] || null;
  } catch (error) {
    console.error('Error fetching link:', error);
    throw error;
  }
}

/**
 * Create a new link
 */
async function createLink(data) {
  try {
    // 1. Pre-generate ID for cleaner transaction ordering
    const id = generateId('links');

    // 2. Create in SurrealDB
    const result = await db.query(`CREATE ${id} SET
      source_id = $source_id,
      target_id = $target_id,
      label = $label,
      created_at = $created_at`, {
      source_id: data.source_id,
      target_id: data.target_id,
      label: data.label || null,
      created_at: new Date().toISOString()
    });

    const link = result[0]?.[0];

    // 3. Persist to file (async, non-blocking)
    fileService.saveLink(link).catch(err => {
      console.error('Failed to persist link to file:', err);
    });

    return link;
  } catch (error) {
    console.error('Error creating link:', error);
    throw error;
  }
}

/**
 * Update an existing link
 */
async function updateLink(id, data) {
  try {
    console.log('Updating link:', id, 'with data:', data);

    const updateQuery = `UPDATE ${id} SET
      label = $label,
      updated_at = $updated_at`;

    const result = await db.query(updateQuery, {
      label: data.label || null,
      updated_at: new Date().toISOString()
    });

    console.log('Update result:', result);
    const link = result[0]?.[0] || null;

    // Persist to file
    if (link) {
      fileService.saveLink(link).catch(err => {
        console.error('Failed to persist link update:', err);
      });
    }

    return link;
  } catch (error) {
    console.error('Error updating link:', error);
    throw error;
  }
}

/**
 * Delete a link
 */
async function deleteLink(id) {
  try {
    console.log('Deleting link:', id);

    // 1. Delete from database
    await db.query(`DELETE ${id}`);

    // 2. Delete link file
    fileService.deleteLinkFile(id).catch(err => {
      console.error('Failed to delete link file:', err);
    });

    return { success: true, id };
  } catch (error) {
    console.error('Error deleting link:', error);
    throw error;
  }
}

/**
 * Get all links connected to a specific node
 */
async function getNodeLinks(nodeId) {
  try {
    const result = await db.query(
      'SELECT * FROM links WHERE source_id = $nodeId OR target_id = $nodeId',
      { nodeId }
    );
    return result[0] || [];
  } catch (error) {
    console.error('Error fetching node links:', error);
    throw error;
  }
}

module.exports = {
  connect,
  disconnect,
  // File sync operations
  populateFromFiles,
  upsertFromFile,
  deleteFromFile,
  clearAllData,
  // Node operations
  getAllNodes,
  getNode,
  createNode,
  updateNode,
  deleteNode,
  // Link operations
  getAllLinks,
  getLink,
  createLink,
  updateLink,
  deleteLink,
  getNodeLinks
};
