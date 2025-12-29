// Corporate Login API - Deprecated
// Login now handled by Auth.js at /api/auth/callback/credentials
// This endpoint exists for backwards compatibility

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Debug: Log where this request is coming from
  const referer = request.headers.get("referer") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  console.log("⚠️ [DEPRECATED] /api/corporate/auth/login called!");
  console.log("   Referer:", referer);
  console.log("   User-Agent:", userAgent.substring(0, 50));
  
  try {
    const body = await request.json();
    console.log("   Body keys:", Object.keys(body));
  } catch {
    console.log("   Body: (not JSON)");
  }

  return NextResponse.json(
    { 
      success: false, 
      error: "Please use the login page. Direct API login is deprecated." 
    },
    { status: 400 }
  );
}
