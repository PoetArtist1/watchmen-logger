/**
 * @module utils/uuid
 * @description UUID v4 generation using Node.js built-in crypto (no extra deps).
 */

const { randomUUID } = require('crypto');

/**
 * Generate a RFC 4122 version 4 UUID.
 * @returns {string} UUID v4 string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 */
function generateUuid() {
  return randomUUID();
}

module.exports = { generateUuid };
