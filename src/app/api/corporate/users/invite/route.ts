// Invite User API
// POST /api/corporate/users/invite
// Admin only - creates an invite for a new user

import { NextRequest, NextResponse } from "next/server";
import { auth, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Admin only" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, name, role, taxiCallerCompanyId, taxiCallerRoles } = body;

    // Validation
    if (!email || !name || !taxiCallerCompanyId) {
      return NextResponse.json(
        { success: false, error: "Email, name, and taxiCallerCompanyId are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Check for existing pending invite
    const existingInvite = await prisma.invite.findFirst({
      where: {
        email: email.toLowerCase(),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { success: false, error: "An active invite already exists for this email" },
        { status: 409 }
      );
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invite
    const invite = await prisma.invite.create({
      data: {
        email: email.toLowerCase(),
        name,
        token,
        role: role || "USER",
        taxiCallerCompanyId: parseInt(taxiCallerCompanyId),
        taxiCallerRoles: taxiCallerRoles || [],
        expiresAt,
        createdById: session.user.id,
      },
    });

    // Generate invite URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/corporate/set-password?token=${token}`;

    console.log(`[Invite] Created invite for ${email} by ${session.user.email}`);

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        name: invite.name,
        expiresAt: invite.expiresAt,
        inviteUrl,
      },
    });
  } catch (error) {
    console.error("[Invite] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create invite" },
      { status: 500 }
    );
  }
}

// GET /api/corporate/users/invite - List pending invites (admin only)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const invites = await prisma.invite.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      invites: invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        name: inv.name,
        role: inv.role,
        taxiCallerCompanyId: inv.taxiCallerCompanyId,
        expiresAt: inv.expiresAt,
        createdBy: inv.createdBy.name,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    console.error("[Invite] List error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list invites" },
      { status: 500 }
    );
  }
}



