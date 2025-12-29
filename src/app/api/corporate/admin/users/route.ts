// Admin API - Manage Corporate Users
// GET: List all users for your company
// POST: Create/invite a new user

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// GET - List users in the admin's company
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const companyId = (session.user as any).taxiCallerCompanyId;

    // Get all users in the same company
    const users = await prisma.user.findMany({
      where: { taxiCallerCompanyId: companyId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        taxiCallerCompanyId: true,
        taxiCallerRoles: true,
        createdAt: true,
        lastLoginAt: true,
        passwordSetAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('[Admin Users] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST - Create a new user
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { email, name, role, taxiCallerCompanyId, password } = body;

    // Validate required fields
    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // Use admin's company ID if not specified (for same-company users)
    const adminCompanyId = (session.user as any).taxiCallerCompanyId;
    const targetCompanyId = taxiCallerCompanyId || adminCompanyId;

    // If password provided, hash it; otherwise generate invite token
    let passwordHash = null;
    let inviteToken = null;
    let inviteTokenExpires = null;

    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    } else {
      // Generate invite token (user will set their own password)
      inviteToken = crypto.randomBytes(32).toString('hex');
      inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        password: passwordHash,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
        taxiCallerCompanyId: targetCompanyId,
        taxiCallerRoles: [],
        inviteToken,
        inviteTokenExpires,
        passwordSetAt: passwordHash ? new Date() : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        taxiCallerCompanyId: true,
        inviteToken: true,
        createdAt: true,
      },
    });

    console.log(`✅ [Admin] User created: ${newUser.email} (Company: ${targetCompanyId})`);

    // Build invite URL if using invite flow
    const inviteUrl = inviteToken
      ? `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/corporate/set-password?token=${inviteToken}`
      : null;

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        taxiCallerCompanyId: newUser.taxiCallerCompanyId,
      },
      inviteUrl,
      message: inviteUrl
        ? 'User created. Send them the invite URL to set their password.'
        : 'User created with password.',
    });
  } catch (error) {
    console.error('[Admin Users] Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

