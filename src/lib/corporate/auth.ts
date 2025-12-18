// Corporate Auth Utilities
// PostgreSQL-backed with cookie-based session management

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import type { CorporateSession, CorporateUser, CorporateCompany } from './types';
import { query, isDatabaseAvailable, areCorporateTablesReady } from './db';

const SESSION_COOKIE_NAME = 'corporate_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

// =============================================================================
// Database Types
// =============================================================================

// Result type from the joined query
interface DBUserWithCompany {
  // User fields
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  company_id: number;
  department: string | null;
  phone: string | null;
  created_at: string;
  // Company fields (aliased in query)
  company_name: string;
  taxicaller_account_id: number;
  company_address: string | null;
  billing_email: string | null;
  cost_centres: Array<{ id: string; name: string; code: string; active?: boolean }> | null;
  departments: string[] | null;
}

// =============================================================================
// Demo Users (Fallback when database is not available)
// =============================================================================

const DEMO_COMPANIES: Record<string, CorporateCompany> = {
  'company-1': {
    id: 'company-1',
    name: 'Inko Co.',
    taxiCallerAccountId: 574252,
    address: 'St Helier, Jersey',
    billingEmail: 'billing@inko.je',
    costCentres: [
      { id: 'cc-1', name: 'Operations', code: 'OPS', active: true },
      { id: 'cc-2', name: 'Sales', code: 'SALES', active: true },
      { id: 'cc-3', name: 'Executive', code: 'EXEC', active: true },
    ],
    departments: ['Operations', 'Sales', 'Marketing', 'Finance', 'Executive'],
  },
  'company-2': {
    id: 'company-2',
    name: 'Bambola Ltd',
    taxiCallerAccountId: 574254,
    address: 'St Brelade, Jersey',
    billingEmail: 'accounts@bambola.je',
    costCentres: [
      { id: 'cc-4', name: 'General', code: 'GEN', active: true },
    ],
    departments: ['General'],
  },
  'company-3': {
    id: 'company-3',
    name: 'The Little, John',
    taxiCallerAccountId: 574256,
    address: 'Trinity, Jersey',
    billingEmail: 'john@littlejohn.je',
    costCentres: [
      { id: 'cc-5', name: 'Main', code: 'MAIN', active: true },
    ],
    departments: ['Main Office'],
  },
};

const DEMO_USERS: Record<string, CorporateUser & { passwordHash: string; companyKey: string }> = {
  'admin@inko.je': {
    id: 'user-1',
    email: 'admin@inko.je',
    name: 'Sarah Admin',
    role: 'admin',
    companyId: 'company-1',
    companyKey: 'company-1',
    department: 'Executive',
    phone: '+447700000001',
    passwordHash: 'demo123',
    createdAt: '2024-01-01T00:00:00Z',
  },
  'booker@inko.je': {
    id: 'user-2',
    email: 'booker@inko.je',
    name: 'Tom Booker',
    role: 'booker',
    companyId: 'company-1',
    companyKey: 'company-1',
    department: 'Operations',
    phone: '+447700000002',
    passwordHash: 'demo123',
    createdAt: '2024-01-15T00:00:00Z',
  },
  'admin@bambola.je': {
    id: 'user-3',
    email: 'admin@bambola.je',
    name: 'Maria Bambola',
    role: 'admin',
    companyId: 'company-2',
    companyKey: 'company-2',
    department: 'General',
    phone: '+447700000003',
    passwordHash: 'demo123',
    createdAt: '2024-02-01T00:00:00Z',
  },
  'john@littlejohn.je': {
    id: 'user-4',
    email: 'john@littlejohn.je',
    name: 'John Little',
    role: 'admin',
    companyId: 'company-3',
    companyKey: 'company-3',
    department: 'Main Office',
    phone: '+447700000004',
    passwordHash: 'demo123',
    createdAt: '2024-03-01T00:00:00Z',
  },
};

// =============================================================================
// Database Auth Functions
// =============================================================================

/**
 * Validate credentials against database
 */
async function validateCredentialsFromDB(
  email: string,
  password: string
): Promise<CorporateSession | null> {
  try {
    // Query user with company data
    const result = await query<DBUserWithCompany>(`
      SELECT 
        u.id, u.email, u.password_hash, u.name, u.role, 
        u.company_id, u.department, u.phone, u.created_at,
        c.name as company_name, c.taxicaller_account_id, 
        c.address as company_address, c.billing_email,
        c.cost_centres, c.departments
      FROM corporate_users u
      JOIN corporate_companies c ON u.company_id = c.id
      WHERE LOWER(u.email) = LOWER($1) AND u.active = true AND c.active = true
    `, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    // Update last login
    await query(`UPDATE corporate_users SET last_login = NOW() WHERE id = $1`, [user.id]);

    // Build session
    const session: CorporateSession = {
      user: {
        id: `user-${user.id}`,
        email: user.email,
        name: user.name,
        role: user.role as 'admin' | 'booker' | 'viewer',
        companyId: `company-${user.company_id}`,
        department: user.department || undefined,
        phone: user.phone || undefined,
        createdAt: user.created_at,
      },
      company: {
        id: `company-${user.company_id}`,
        name: user.company_name,
        taxiCallerAccountId: user.taxicaller_account_id,
        address: user.company_address || undefined,
        billingEmail: user.billing_email || undefined,
        costCentres: (user.cost_centres || []).map(cc => ({
          ...cc,
          active: cc.active ?? true, // Default to true if not specified
        })),
        departments: user.departments || [],
      },
      expiresAt: Date.now() + SESSION_DURATION,
    };

    console.log(`[Corporate Auth] DB login successful: ${email}`);
    return session;
  } catch (error) {
    console.error('[Corporate Auth] DB validation error:', error);
    return null;
  }
}

/**
 * Validate credentials against demo users (fallback)
 */
function validateCredentialsFromDemo(
  email: string,
  password: string
): CorporateSession | null {
  const normalizedEmail = email.toLowerCase().trim();
  const user = DEMO_USERS[normalizedEmail];

  if (!user || user.passwordHash !== password) {
    return null;
  }

  const company = DEMO_COMPANIES[user.companyKey];
  if (!company) {
    return null;
  }

  console.log(`[Corporate Auth] Demo login: ${email}`);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'admin' | 'booker' | 'viewer',
      companyId: user.companyId,
      department: user.department,
      phone: user.phone,
      createdAt: user.createdAt,
    },
    company,
    expiresAt: Date.now() + SESSION_DURATION,
  };
}

// =============================================================================
// Public Auth Functions
// =============================================================================

/**
 * Check if we should use database authentication
 */
export async function isUsingDatabase(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    return false;
  }
  
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return false;
    
    const tablesReady = await areCorporateTablesReady();
    return tablesReady;
  } catch {
    return false;
  }
}

/**
 * Validate login credentials
 * Uses database if available, falls back to demo users
 */
export async function validateCredentials(
  email: string,
  password: string
): Promise<CorporateSession | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // Try database first
  const useDB = await isUsingDatabase();
  
  if (useDB) {
    const session = await validateCredentialsFromDB(normalizedEmail, password);
    if (session) return session;
  }

  // Fallback to demo users (for local development)
  if (process.env.NODE_ENV === 'development' || !useDB) {
    return validateCredentialsFromDemo(normalizedEmail, password);
  }

  return null;
}

/**
 * Create session cookie
 */
export async function createSessionCookie(session: CorporateSession): Promise<void> {
  const cookieStore = await cookies();
  const sessionData = JSON.stringify(session);
  const encoded = Buffer.from(sessionData).toString('base64');

  cookieStore.set(SESSION_COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION / 1000,
  });
}

/**
 * Get current session from cookie
 */
export async function getSession(): Promise<CorporateSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
    const session: CorporateSession = JSON.parse(decoded);

    if (session.expiresAt < Date.now()) {
      await clearSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Clear session cookie (logout)
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Check if user has required role
 */
export function hasRole(session: CorporateSession | null, requiredRoles: string[]): boolean {
  if (!session) return false;
  return requiredRoles.includes(session.user.role);
}

/**
 * Get user's TaxiCaller account ID
 */
export function getTaxiCallerAccountId(session: CorporateSession): number {
  return session.company.taxiCallerAccountId;
}

/**
 * Get demo users (for login page display in dev mode)
 */
export function getDemoUsers(): Array<{ email: string; company: string; role: string }> {
  return Object.values(DEMO_USERS).map(u => ({
    email: u.email,
    company: DEMO_COMPANIES[u.companyKey]?.name || '',
    role: u.role,
  }));
}
