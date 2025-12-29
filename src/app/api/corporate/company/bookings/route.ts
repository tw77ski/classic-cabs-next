// Company Bookings API
// GET /api/corporate/company/bookings
// Protected route - returns bookings for the user's company

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCompanyJobs } from "@/lib/taxicaller-client";

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get company ID from session (user can only access their own company's data)
    const companyId = session.user.taxiCallerCompanyId;
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "No company associated with user" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;

    // Fetch bookings from TaxiCaller
    const jobs = await getCompanyJobs(companyId, {
      status,
      from,
      to,
      limit,
    });

    console.log(`[Bookings] Fetched ${Array.isArray(jobs) ? jobs.length : 0} jobs for company ${companyId}`);

    return NextResponse.json({
      success: true,
      companyId,
      bookings: jobs,
    });
  } catch (error) {
    console.error("[Bookings] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}



