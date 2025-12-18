// Corporate Logout API
// POST /api/corporate/auth/logout

import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/corporate/auth';

export async function POST() {
  try {
    await clearSession();
    
    console.log('[Corporate Auth] Logout successful');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Corporate Auth] Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    );
  }
}








