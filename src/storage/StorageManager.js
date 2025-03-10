/**
 * StorageManager - The dankest IndexedDB wrapper for your web app's storage needs.
 * High-throughput, queue-based, and frame-skipping awesome sauce for CRUD operations.
 * @version 1.0.0
 * @author Grok 3 (xAI) - Your friendly AI sidekick
 */
class StorageManager {
    /**
     * Creates a new StorageManager instance.
     * @param {string} dbName - Name of the IndexedDB database.
     * @param {string} storeName - Name of the object store.
     * @param {number} [frameSkip=2] - How many frames to skip between queue processing (default: 2 for balance).
     */
    constructor(dbName, storeName, frameSkip = 2) {
      this.dbName = dbName;
      this.storeName = storeName;
      this.frameSkip = frameSkip;
      this.db = null; // IndexedDB instance
      this.queue = []; // Operation queue for high throughput
      this.frameCount = 0; // Tracks frames for skipping
      this.isProcessing = false; // Prevents concurrent queue processing
  
      // Initialize the database
      this.initDB();
    }
  
    /**
     * Initializes the IndexedDB database and object store.
     * @private
     * @returns {Promise<void>} Resolves when DB is ready, or rejects on failure.
     */
    async initDB() {
      try {
        this.db = await new Promise((resolve, reject) => {
          const request = indexedDB.open(this.dbName, 1);
  
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName, { keyPath: 'id' }); // Auto-incrementing keys
            }
          };
  
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
        throw error;
      }
    }
  
    /**
     * Adds an operation to the queue with priority.
     * @private
     * @param {string} type - Operation type ('write', 'update', 'delete', 'get').
     * @param {Object} data - Data for the operation (e.g., { id, value } for write/update).
     * @param {Function} callback - Callback for operation result.
     * @returns {void}
     */
    enqueue(type, data, callback) {
      this.queue.push({ type, data, callback });
      this.processQueueIfReady(); // Start processing if not already
    }
  
    /**
     * Processes the queue with frame skipping to avoid main thread blocking.
     * @private
     * @returns {void}
     */
    processQueueIfReady() {
      if (this.isProcessing || this.frameCount % this.frameSkip !== 0) {
        this.frameCount++; // Increment frame counter
        return; // Skip this frame if not ready
      }
  
      this.isProcessing = true;
      this.frameCount = 0; // Reset frame counter
  
      // Process the queue asynchronously
      this.processNextInQueue().finally(() => {
        this.isProcessing = false;
        if (this.queue.length > 0) {
          requestAnimationFrame(() => this.processQueueIfReady()); // Continue on next frame
        }
      });
    }
  
    /**
     * Processes the next operation in the queue.
     * @private
     * @returns {Promise<void>} Resolves when the operation is complete.
     */
    async processNextInQueue() {
      if (this.queue.length === 0) return;
  
      const { type, data, callback } = this.queue.shift(); // Dequeue the operation
      try {
        let result;
        switch (type) {
          case 'write':
            result = await this.write(data);
            break;
          case 'update':
            result = await this.update(data);
            break;
          case 'delete':
            result = await this.delete(data.id);
            break;
          case 'get':
            result = await this.get(data.id);
            break;
          default:
            throw new Error(`Unknown operation type: ${type}`);
        }
        callback?.(null, result); // Success callback
      } catch (error) {
        callback?.(error); // Error callback
        console.error(`Queue operation failed: ${type}`, error);
      }
    }
  
    /**
     * Writes data to IndexedDB.
     * @param {Object} data - Data to write (must have an 'id' property).
     * @returns {Promise<Object>} The written data.
     */
    async write(data) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.add(data);
  
        request.onsuccess = () => resolve(data);
        request.onerror = () => reject(request.error);
      });
    }
  
    /**
     * Updates data in IndexedDB.
     * @param {Object} data - Data to update (must have an 'id' property).
     * @returns {Promise<Object>} The updated data.
     */
    async update(data) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(data);
  
        request.onsuccess = () => resolve(data);
        request.onerror = () => reject(request.error);
      });
    }
  
    /**
     * Deletes data from IndexedDB by ID.
     * @param {string|number} id - ID of the data to delete.
     * @returns {Promise<void>}
     */
    async delete(id) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(id);
  
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  
    /**
     * Retrieves data from IndexedDB by ID.
     * @param {string|number} id - ID of the data to retrieve.
     * @returns {Promise<Object|null>} The retrieved data or null if not found.
     */
    async get(id) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(id);
  
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    }
  
    /**
     * Public method to write data (queues the operation).
     * @param {Object} data - Data to write.
     * @param {Function} [callback] - Optional callback for result/error.
     * @returns {void}
     */
    writeQueued(data, callback) {
      this.enqueue('write', data, callback);
    }
  
    /**
     * Public method to update data (queues the operation).
     * @param {Object} data - Data to update.
     * @param {Function} [callback] - Optional callback for result/error.
     * @returns {void}
     */
    updateQueued(data, callback) {
      this.enqueue('update', data, callback);
    }
  
    /**
     * Public method to delete data (queues the operation).
     * @param {string|number} id - ID of the data to delete.
     * @param {Function} [callback] - Optional callback for result/error.
     * @returns {void}
     */
    deleteQueued(id, callback) {
      this.enqueue('delete', { id }, callback);
    }
  
    /**
     * Public method to get data (queues the operation).
     * @param {string|number} id - ID of the data to retrieve.
     * @param {Function} [callback] - Optional callback for result/error.
     * @returns {void}
     */
    getQueued(id, callback) {
      this.enqueue('get', { id }, callback);
    }
  }
  
  // Example usage:
  /*
  const storage = new StorageManager('MyAppDB', 'MyStore', 2); // Frame skip every 2 frames
  
  // Queue some operations
  storage.writeQueued({ id: 'user1', name: 'Grok' }, (error, result) => {
    if (error) console.error('Write failed:', error);
    else console.log('Wrote:', result);
  });
  
  storage.updateQueued({ id: 'user1', name: 'Grok 3' }, (error, result) => {
    if (error) console.error('Update failed:', error);
    else console.log('Updated:', result);
  });
  
  storage.getQueued('user1', (error, result) => {
    if (error) console.error('Get failed:', error);
    else console.log('Got:', result);
  });
  
  storage.deleteQueued('user1', (error) => {
    if (error) console.error('Delete failed:', error);
    else console.log('Deleted!');
  });
  