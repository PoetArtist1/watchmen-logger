/**
 * @module monitoring/metricsCache
 * @description Simple TTL cache for aggregated metrics (RF-03).
 */

/**
 * @param {number} ttlSeconds
 * @returns {{ get: Function, set: Function, clear: Function }}
 */
function createMetricsCache(ttlSeconds = 30) {
  let entry = null;

  return {
    /**
     * @returns {object|null}
     */
    get() {
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        entry = null;
        return null;
      }
      return entry.value;
    },

    /**
     * @param {object} value
     */
    set(value) {
      entry = {
        value,
        expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000
      };
    },

    clear() {
      entry = null;
    }
  };
}

module.exports = { createMetricsCache };
