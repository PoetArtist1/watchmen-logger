-- Migration 001: Create requests table
-- Storage for captured HTTP request/response data

CREATE TABLE IF NOT EXISTS requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    method VARCHAR(10) NOT NULL,
    path TEXT NOT NULL,
    full_url TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    client_ip VARCHAR(45),
    client_port INTEGER,
    user_agent TEXT,
    request_headers JSONB,
    request_query JSONB,
    request_body JSONB,
    response_headers JSONB,
    response_body JSONB,
    response_size_bytes INTEGER,
    error_message TEXT,
    stack_trace TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for efficient queries
CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_requests_path ON requests(path);
CREATE INDEX IF NOT EXISTS idx_requests_status_code ON requests(status_code);
CREATE INDEX IF NOT EXISTS idx_requests_method ON requests(method);
CREATE INDEX IF NOT EXISTS idx_requests_latency ON requests(latency_ms);
CREATE INDEX IF NOT EXISTS idx_requests_headers ON requests USING GIN (request_headers);
