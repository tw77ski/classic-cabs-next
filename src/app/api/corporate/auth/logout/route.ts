// Corporate Logout API - Now uses Auth.js
import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export async function POST() {
  try {
    // Sign out using Auth.js
    await signOut({ redirect: false });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Logout API] Error:", error);
    // Even if there's an error, return success as we want the user logged out
    return NextResponse.json({ success: true });
  }
}
