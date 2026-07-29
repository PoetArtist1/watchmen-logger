-- Migration 002: Create manual_logs table
-- Storage for manual log entries from logInfo, logWarning, logError, logDebug

CREATE TABLE IF NOT EXISTS manual_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    metadata JSONB,
    context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for efficient queries
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON manual_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON manual_logs(level);
