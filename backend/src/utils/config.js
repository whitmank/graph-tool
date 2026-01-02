const path = require('path')

/**
 * Backend configuration
 * All paths are relative to the project root (../../..)
 */
module.exports = {
  // Server settings
  PORT: process.env.PORT || 3000,

  // SurrealDB settings
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: process.env.DB_PORT || 8000,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASS: process.env.DB_PASS || 'root',

  // Data directories (at project root)
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '../../../data'),
  FILES_DIR: process.env.FILES_DIR || path.join(__dirname, '../../../files'),
  CONFIG_FILE: path.join(__dirname, '../../../data-sources.json'),

  // Frontend build output
  FRONTEND_DIST: path.join(__dirname, '../../../frontend/dist')
}
