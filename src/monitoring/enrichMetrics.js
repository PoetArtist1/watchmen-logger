/**
 * @module monitoring/enrichMetrics
 * @description Normalize metrics payloads across storage strategies (e.g. add timeline).
 */

/**
 * Build a per-minute timeline for the last hour from request rows.
 * @param {object[]} records
 * @returns {{ timestamp: string, count: number, avg_latency: number }[]}
 */
function buildTimelineFromRecords(records) {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const buckets = new Map();

  for (let t = oneHourAgo; t <= now; t += 60000) {
    const key = new Date(Math.floor(t / 60000) * 60000).toISOString();
    buckets.set(key, { timestamp: key, count: 0, latencySum: 0 });
  }

  for (const r of records) {
    const ts = new Date(r.timestamp).getTime();
    if (Number.isNaN(ts) || ts < oneHourAgo) continue;
    const key = new Date(Math.floor(ts / 60000) * 60000).toISOString();
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.latencySum += Number(r.latency_ms) || 0;
  }

  return Array.from(buckets.values()).map((b) => ({
    timestamp: b.timestamp,
    count: b.count,
    avg_latency: b.count ? Math.round(b.latencySum / b.count) : 0
  }));
}

/**
 * Ensure metrics include fields the UI expects.
 * @param {object} metrics
 * @param {import('../storage/StorageStrategy')} storage
 * @returns {Promise<object>}
 */
async function enrichMetrics(metrics, storage) {
  const next = { ...metrics };

  if (!Array.isArray(next.timeline) || next.timeline.length === 0) {
    try {
      const recent = await storage.findAll({}, { limit: 200, order: 'desc' });
      next.timeline = buildTimelineFromRecords(recent.data || []);
    } catch {
      next.timeline = [];
    }
  }

  if (!Array.isArray(next.recent_errors)) {
    next.recent_errors = [];
  }
  if (!Array.isArray(next.top_endpoints)) {
    next.top_endpoints = [];
  }
  if (!Array.isArray(next.slowest_endpoints)) {
    next.slowest_endpoints = [];
  }

  return next;
}

module.exports = { enrichMetrics, buildTimelineFromRecords };
