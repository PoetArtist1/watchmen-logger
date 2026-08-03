-- Migration 003: Add client_port to requests (IP:port display in monitoring UI)

ALTER TABLE requests ADD COLUMN IF NOT EXISTS client_port INTEGER;
