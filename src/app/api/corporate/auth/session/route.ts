// Corporate Auth Session Check
// GET /api/corporate/auth/session
// Returns current session state for corporate users

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("corporate_session")?.value;

    if (!sessionToken) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        company: null,
      });
    }

    // In production, validate the session token against your database/auth service
    // For now, we'll decode a simple JWT-like token or check localStorage session
    
    try {
      // Simple base64 decode for demo purposes
      // In production, use proper JWT validation with a secret
      const sessionData = JSON.parse(
        Buffer.from(sessionToken, "base64").toString("utf-8")
      );

      // Check if session is expired
      if (sessionData.exp && Date.now() > sessionData.exp) {
        // Clear expired cookie
        const response = NextResponse.json({
          authenticated: false,
          user: null,
          company: null,
        });
        response.cookies.delete("corporate_session");
        return response;
      }

      return NextResponse.json({
        authenticated: true,
        user: {
          id: sessionData.userId || "1",
          name: sessionData.userName || "Corporate User",
          email: sessionData.userEmail || "user@company.com",
          role: sessionData.role || "user",
          department: sessionData.department,
        },
        company: {
          id: sessionData.companyId || "1",
          name: sessionData.companyName || "Demo Company",
          taxiCallerAccountId: sessionData.taxiCallerAccountId || 1,
        },
      });
    } catch {
      // Invalid session token format
      const response = NextResponse.json({
        authenticated: false,
        user: null,
        company: null,
      });
      response.cookies.delete("corporate_session");
      return response;
    }
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { authenticated: false, error: "Session check failed" },
      { status: 500 }
    );
  }
}
