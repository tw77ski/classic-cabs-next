// Corporate Auth Status API
// GET /api/corporate/auth/status
// Returns whether we're using database auth or demo mode

import { NextResponse } from 'next/server';
import { isUsingDatabase, getDemoUsers } from '@/lib/corporate/auth';

export async function GET() {
  try {
    const usingDatabase = await isUsingDatabase();
    
    // Only return demo users if NOT using database
    const demoUsers = !usingDatabase ? getDemoUsers() : [];
    
    return NextResponse.json({
      success: true,
      mode: usingDatabase ? 'database' : 'demo',
      demoUsers,
    });
  } catch (error) {
    console.error('[Corporate Auth Status] Error:', error);
    return NextResponse.json({
      success: true,
      mode: 'demo',
      demoUsers: getDemoUsers(),
    });
  }
}




