-- Corporate Portal Database Schema
-- Run this on your PostgreSQL database (Linode)

-- =============================================================================
-- CORPORATE COMPANIES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS corporate_companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  taxicaller_account_id INTEGER NOT NULL,
  address TEXT,
  billing_email VARCHAR(255),
  cost_centres JSONB DEFAULT '[]',
  departments JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- CORPORATE USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS corporate_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'booker', -- admin, booker, viewer
  company_id INTEGER REFERENCES corporate_companies(id) ON DELETE CASCADE,
  department VARCHAR(255),
  phone VARCHAR(50),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- =============================================================================
-- CORPORATE SESSIONS TABLE (optional - for server-side session storage)
-- =============================================================================
CREATE TABLE IF NOT EXISTS corporate_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES corporate_users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_corporate_users_email ON corporate_users(email);
CREATE INDEX IF NOT EXISTS idx_corporate_users_company ON corporate_users(company_id);
CREATE INDEX IF NOT EXISTS idx_corporate_sessions_token ON corporate_sessions(token);
CREATE INDEX IF NOT EXISTS idx_corporate_sessions_expires ON corporate_sessions(expires_at);

-- =============================================================================
-- SAMPLE DATA (Remove or modify for production)
-- =============================================================================

-- Insert sample companies (these map to TaxiCaller account IDs)
-- INSERT INTO corporate_companies (name, taxicaller_account_id, billing_email, departments, cost_centres) VALUES
-- ('Inko Co.', 574252, 'billing@inko.je', '["Operations", "Sales", "Executive"]', '[{"id": "cc-1", "name": "Operations", "code": "OPS"}, {"id": "cc-2", "name": "Sales", "code": "SALES"}]'),
-- ('Bambola Ltd', 574254, 'accounts@bambola.je', '["General"]', '[{"id": "cc-3", "name": "General", "code": "GEN"}]');

-- Insert sample users (password is 'demo123' - replace with real bcrypt hashes in production)
-- Generate hash with: node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"
-- INSERT INTO corporate_users (email, password_hash, name, role, company_id, department, phone) VALUES
-- ('admin@inko.je', '$2a$10$...', 'Sarah Admin', 'admin', 1, 'Executive', '+447700000001'),
-- ('booker@inko.je', '$2a$10$...', 'Tom Booker', 'booker', 1, 'Operations', '+447700000002');

