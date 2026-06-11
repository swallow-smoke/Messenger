-- Enable required PostgreSQL extensions
-- Run this once before any other migrations
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
