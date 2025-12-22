// Corporate Session API - Now uses Auth.js
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        company: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      },
      company: {
        id: session.user.companyId,
        name: session.user.companyName,
        taxiCallerAccountId: session.user.taxiCallerAccountId,
      },
    });
  } catch (error) {
    console.error("[Session API] Error:", error);
    return NextResponse.json({
      authenticated: false,
      user: null,
      company: null,
    });
  }
}
