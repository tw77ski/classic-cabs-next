// Corporate Login API
// POST /api/corporate/auth/login

import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, createSessionCookie } from '@/lib/corporate/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate credentials
    const session = await validateCredentials(email, password);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create session cookie
    await createSessionCookie(session);

    console.log(`[Corporate Auth] Login successful: ${email} (${session.company.name})`);

    return NextResponse.json({
      success: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      },
      company: {
        id: session.company.id,
        name: session.company.name,
      },
    });
  } catch (error) {
    console.error('[Corporate Auth] Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}








