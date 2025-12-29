-- Corporate Portal Database Setup
-- Run this in PostgreSQL: sudo -u postgres psql -d classic_cabs -f scripts/setup-database.sql

-- Create tables
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

CREATE TABLE IF NOT EXISTS corporate_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'booker',
  company_id INTEGER REFERENCES corporate_companies(id) ON DELETE CASCADE,
  department VARCHAR(255),
  phone VARCHAR(50),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

CREATE TABLE IF NOT EXISTS corporate_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES corporate_users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_corporate_users_email ON corporate_users(email);
CREATE INDEX IF NOT EXISTS idx_corporate_users_company ON corporate_users(company_id);

-- Insert demo company
INSERT INTO corporate_companies (name, taxicaller_account_id, billing_email, address)
VALUES ('Demo Company Ltd', 574252, 'billing@democompany.je', 'St Helier, Jersey')
ON CONFLICT DO NOTHING;

-- Insert demo admin user (password: demo123)
-- bcrypt hash for "demo123"
INSERT INTO corporate_users (email, password_hash, name, role, company_id, department, phone)
VALUES (
  'admin@democompany.je',
  '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqQlRJqPyf/h/UvB3Z1fBHLJn3y4K',
  'Demo Admin',
  'admin',
  1,
  'Management',
  '+447700000001'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name;

-- Insert demo booker user (password: demo123)
INSERT INTO corporate_users (email, password_hash, name, role, company_id, department, phone)
VALUES (
  'booker@democompany.je',
  '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqQlRJqPyf/h/UvB3Z1fBHLJn3y4K',
  'Demo Booker',
  'booker',
  1,
  'Operations',
  '+447700000002'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name;

-- Show results
SELECT 'Tables created successfully!' as status;
SELECT '---' as separator;
SELECT 'Demo users created:' as info;
SELECT email, name, role FROM corporate_users;



