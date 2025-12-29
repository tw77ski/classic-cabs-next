// Corporate Auth Status API
// GET /api/corporate/auth/status
// Returns auth mode - always database with Auth.js

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    mode: 'database',
    demoUsers: [
      { email: 'admin@classiccabs.je', company: 'Classic Cabs Jersey', role: 'ADMIN' },
      { email: 'booker@classiccabs.je', company: 'Classic Cabs Jersey', role: 'USER' },
    ],
  });
}
