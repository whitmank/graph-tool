const fs = require('fs').promises;
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'data-sources.json');

/**
 * Data Source Manager Service
 * Handles reading/writing config, validating paths, and managing data source switching
 */

// Read the data sources configuration
async function getConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read data sources config:', error);
    // Return default config if file doesn't exist or is invalid
    return {
      current: 'default',
      sources: {
        default: {
          name: 'Default (Project Files)',
          path: './files',
          description: 'Default data storage in project folder'
        }
      }
    };
  }
}

// Write the data sources configuration
async function saveConfig(config) {
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log('[DataSource] Configuration saved');
  } catch (error) {
    console.error('Failed to save data sources config:', error);
    throw error;
  }
}

// Get all available data sources
async function getAllSources() {
  const config = await getConfig();
  return config.sources;
}

// Get current active data source
async function getCurrentSource() {
  const config = await getConfig();
  const currentId = config.current;
  const source = config.sources[currentId];

  if (!source) {
    throw new Error(`Current data source "${currentId}" not found in config`);
  }

  return {
    id: currentId,
    ...source
  };
}

// Validate that a data source path exists and is accessible
async function validateSourcePath(sourcePath) {
  try {
    // Resolve relative paths
    const absolutePath = path.resolve(__dirname, sourcePath);

    // Try to create the directory structure if it doesn't exist
    const nodesDir = path.join(absolutePath, 'nodes');
    const linksDir = path.join(absolutePath, 'links');

    // Create directories recursively (won't fail if they already exist)
    await fs.mkdir(nodesDir, { recursive: true });
    await fs.mkdir(linksDir, { recursive: true });

    // Verify the main directory exists and is a directory
    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      return {
        valid: false,
        error: 'Path exists but is not a directory'
      };
    }

    return {
      valid: true,
      absolutePath,
      nodesDir,
      linksDir
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to create or access directory: ${error.message}`
    };
  }
}

// Add a new data source
async function addSource(id, sourceData) {
  const config = await getConfig();

  // Check if ID already exists, and generate a unique one if needed
  let finalId = id;
  let counter = 1;
  while (config.sources[finalId]) {
    finalId = `${id}-${counter}`;
    counter++;
  }

  // Validate the path
  const validation = await validateSourcePath(sourceData.path);
  if (!validation.valid) {
    throw new Error(`Invalid data source path: ${validation.error}`);
  }

  // Add to config
  config.sources[finalId] = {
    name: sourceData.name,
    path: sourceData.path,
    description: sourceData.description || ''
  };

  await saveConfig(config);

  return {
    id: finalId,
    ...config.sources[finalId]
  };
}

// Remove a data source
async function removeSource(id) {
  const config = await getConfig();

  // Can't remove default source
  if (id === 'default') {
    throw new Error('Cannot remove default data source');
  }

  // Can't remove current active source
  if (config.current === id) {
    throw new Error('Cannot remove currently active data source. Switch to another source first.');
  }

  // Check if source exists
  if (!config.sources[id]) {
    throw new Error(`Data source "${id}" not found`);
  }

  delete config.sources[id];
  await saveConfig(config);
}

// Switch to a different data source (with hot reload)
async function switchSource(newSourceId) {
  const config = await getConfig();

  // Check if source exists
  if (!config.sources[newSourceId]) {
    throw new Error(`Data source "${newSourceId}" not found`);
  }

  const newSource = config.sources[newSourceId];

  // Validate the new source path
  const validation = await validateSourcePath(newSource.path);
  if (!validation.valid) {
    throw new Error(`Cannot switch to data source: ${validation.error}`);
  }

  // Update current source in config
  const oldSourceId = config.current;
  config.current = newSourceId;
  await saveConfig(config);

  console.log(`[DataSource] Switching from "${oldSourceId}" to "${newSourceId}"`);

  return {
    id: newSourceId,
    ...newSource,
    absolutePath: validation.absolutePath,
    nodesDir: validation.nodesDir,
    linksDir: validation.linksDir
  };
}

module.exports = {
  getConfig,
  saveConfig,
  getAllSources,
  getCurrentSource,
  validateSourcePath,
  addSource,
  removeSource,
  switchSource
};
