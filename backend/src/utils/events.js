const EventEmitter = require('events')

/**
 * DataChangeEmitter - Event emitter for broadcasting data changes
 *
 * Events:
 * - 'data-change' (type, action, id) - Emitted when nodes or links change
 *   - type: 'node' | 'link'
 *   - action: 'added' | 'updated' | 'deleted'
 *   - id: Record ID (e.g., 'nodes:abc123')
 */
class DataChangeEmitter extends EventEmitter {}

module.exports = new DataChangeEmitter()
