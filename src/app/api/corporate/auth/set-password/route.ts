// Set Password API - For invited users
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Find user with this invite token
    const user = await prisma.user.findFirst({
      where: {
        inviteToken: token,
        inviteTokenExpires: { gt: new Date() }, // Not expired
        passwordSetAt: null, // Password not yet set
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired invite token' },
        { status: 400 }
      );
    }

    // Hash the password and update user
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        passwordSetAt: new Date(),
        inviteToken: null, // Clear the token
        inviteTokenExpires: null,
      },
    });

    console.log(`✅ [Set Password] User ${user.email} set their password`);

    return NextResponse.json({
      success: true,
      message: 'Password set successfully. You can now log in.',
    });
  } catch (error) {
    console.error('[Set Password] Error:', error);
    return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
  }
}
