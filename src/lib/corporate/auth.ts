// Corporate Auth Utilities
// Cookie-based session management (can be upgraded to Supabase)

import { cookies } from 'next/headers';
import type { CorporateSession, CorporateUser, CorporateCompany } from './types';

const SESSION_COOKIE_NAME = 'corporate_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

// =============================================================================
// Demo Users (Replace with Supabase in production)
// =============================================================================

// Demo companies linked to TaxiCaller accounts
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

// Demo users (password: "demo123" for all)
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
    passwordHash: 'demo123', // In production, use bcrypt
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
// Auth Functions
// =============================================================================

/**
 * Validate login credentials
 * Returns session data or null if invalid
 */
export async function validateCredentials(
  email: string,
  password: string
): Promise<CorporateSession | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = DEMO_USERS[normalizedEmail];

  if (!user) {
    return null;
  }

  // In production, use bcrypt.compare()
  if (user.passwordHash !== password) {
    return null;
  }

  const company = DEMO_COMPANIES[user.companyKey];
  if (!company) {
    return null;
  }

  // Create session
  const session: CorporateSession = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      department: user.department,
      phone: user.phone,
      createdAt: user.createdAt,
    },
    company,
    expiresAt: Date.now() + SESSION_DURATION,
  };

  return session;
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
    maxAge: SESSION_DURATION / 1000, // seconds
  });
}

/**
 * Get current session from cookie
 * Returns null if no valid session
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

    // Check if expired
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








