#!/usr/bin/env npx ts-node

/**
 * Corporate Portal User Setup Script
 * 
 * Usage:
 *   npx ts-node scripts/setup-corporate-users.ts
 * 
 * Or with environment variable:
 *   DATABASE_URL="postgresql://user:pass@host:5432/db" npx ts-node scripts/setup-corporate-users.ts
 * 
 * This script will:
 * 1. Create the corporate tables if they don't exist
 * 2. Add sample companies and users
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper to prompt for input
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Create tables
async function createTables() {
  console.log('📦 Creating corporate tables...');
  
  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS corporate_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES corporate_users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_corporate_users_email ON corporate_users(email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_corporate_users_company ON corporate_users(company_id)`);
  
  console.log('✅ Tables created successfully');
}

// Add a company
async function addCompany(
  name: string,
  taxiCallerAccountId: number,
  billingEmail: string,
  address?: string
): Promise<number> {
  const result = await pool.query(
    `INSERT INTO corporate_companies (name, taxicaller_account_id, billing_email, address)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [name, taxiCallerAccountId, billingEmail, address || null]
  );
  
  if (result.rows.length > 0) {
    console.log(`✅ Company "${name}" created with ID: ${result.rows[0].id}`);
    return result.rows[0].id;
  }
  
  // If already exists, get the ID
  const existing = await pool.query(
    `SELECT id FROM corporate_companies WHERE name = $1`,
    [name]
  );
  return existing.rows[0]?.id;
}

// Add a user
async function addUser(
  email: string,
  password: string,
  name: string,
  role: 'admin' | 'booker' | 'viewer',
  companyId: number,
  department?: string,
  phone?: string
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 10);
  
  try {
    await pool.query(
      `INSERT INTO corporate_users (email, password_hash, name, role, company_id, department, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         company_id = EXCLUDED.company_id,
         department = EXCLUDED.department,
         phone = EXCLUDED.phone`,
      [email.toLowerCase(), passwordHash, name, role, companyId, department || null, phone || null]
    );
    console.log(`✅ User "${email}" created/updated (role: ${role})`);
  } catch (error) {
    console.error(`❌ Failed to create user "${email}":`, error);
  }
}

// Interactive setup
async function interactiveSetup() {
  console.log('\n🏢 Add a new corporate company\n');
  
  const companyName = await prompt('Company name: ');
  const accountId = await prompt('TaxiCaller Account ID: ');
  const billingEmail = await prompt('Billing email: ');
  const address = await prompt('Address (optional): ');
  
  const companyId = await addCompany(
    companyName,
    parseInt(accountId, 10),
    billingEmail,
    address || undefined
  );
  
  console.log('\n👤 Add an admin user for this company\n');
  
  const userEmail = await prompt('Admin email: ');
  const userName = await prompt('Admin name: ');
  const userPassword = await prompt('Password: ');
  const userPhone = await prompt('Phone (optional): ');
  
  await addUser(
    userEmail,
    userPassword,
    userName,
    'admin',
    companyId,
    'Management',
    userPhone || undefined
  );
  
  const addMore = await prompt('\nAdd another user for this company? (y/n): ');
  if (addMore.toLowerCase() === 'y') {
    const email2 = await prompt('User email: ');
    const name2 = await prompt('User name: ');
    const password2 = await prompt('Password: ');
    const role2 = await prompt('Role (admin/booker/viewer): ') as 'admin' | 'booker' | 'viewer';
    
    await addUser(email2, password2, name2, role2 || 'booker', companyId);
  }
}

// Quick setup with sample data
async function quickSetup() {
  console.log('\n🚀 Quick setup with sample data...\n');
  
  // Add sample companies
  const company1Id = await addCompany(
    'Demo Company Ltd',
    574252, // Replace with actual TaxiCaller account ID
    'billing@democompany.je',
    'St Helier, Jersey'
  );
  
  // Add sample users (password: "demo123")
  await addUser('admin@democompany.je', 'demo123', 'Demo Admin', 'admin', company1Id, 'Management', '+447700000001');
  await addUser('booker@democompany.je', 'demo123', 'Demo Booker', 'booker', company1Id, 'Operations', '+447700000002');
  
  console.log('\n✅ Quick setup complete!');
  console.log('\n📝 Sample credentials:');
  console.log('   Email: admin@democompany.je');
  console.log('   Password: demo123');
}

// Main
async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Corporate Portal - User Setup Script     ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('\nSet it with:');
    console.log('  export DATABASE_URL="postgresql://user:pass@host:5432/dbname"');
    process.exit(1);
  }
  
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connected\n');
    
    // Create tables
    await createTables();
    
    // Ask for setup mode
    console.log('\nSetup options:');
    console.log('  1. Quick setup (sample company + users)');
    console.log('  2. Interactive setup (create custom company + users)');
    console.log('  3. Exit\n');
    
    const choice = await prompt('Choose option (1/2/3): ');
    
    switch (choice) {
      case '1':
        await quickSetup();
        break;
      case '2':
        await interactiveSetup();
        break;
      default:
        console.log('Exiting...');
    }
    
    // Show existing users
    console.log('\n📋 Current corporate users:');
    const users = await pool.query(`
      SELECT u.email, u.name, u.role, c.name as company
      FROM corporate_users u
      JOIN corporate_companies c ON u.company_id = c.id
      ORDER BY c.name, u.role
    `);
    
    if (users.rows.length === 0) {
      console.log('   No users found');
    } else {
      users.rows.forEach((u: { email: string; name: string; role: string; company: string }) => {
        console.log(`   ${u.email} (${u.name}) - ${u.company} [${u.role}]`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

main();






