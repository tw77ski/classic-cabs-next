// Company Users API
// GET /api/corporate/company/users
// Returns users for the same company as the requesting user

import { NextResponse } from "next/server";
import { auth, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const companyId = session.user.taxiCallerCompanyId;
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "No company associated with user" },
        { status: 403 }
      );
    }

    // Only admins can see all users
    if (!isAdmin(session)) {
      // Non-admins can only see themselves
      return NextResponse.json({
        success: true,
        users: [{
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
        }],
      });
    }

    // Fetch all users in the same company
    const users = await prisma.user.findMany({
      where: {
        taxiCallerCompanyId: companyId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        taxiCallerRoles: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    console.log(`[Users] Found ${users.length} users for company ${companyId}`);

    return NextResponse.json({
      success: true,
      companyId,
      users,
    });
  } catch (error) {
    console.error("[Users] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}



