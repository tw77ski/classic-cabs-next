import { NextResponse } from "next/server";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const accountId = searchParams.get("accountId");

    const apiDomain = process.env.TAXICALLER_API_DOMAIN || "api.taxicaller.net";
    const apiKey = process.env.TAXICALLER_API_KEY;
    const companyId = process.env.TAXICALLER_COMPANY_ID;
    const jwt = process.env.TAXICALLER_DEV_JWT;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Missing TaxiCaller company ID" },
        { status: 500 }
      );
    }

    // Try JWT auth first (for RC environment), fall back to API key
    let url: string;
    let headers: Record<string, string> = {};

    if (jwt && apiDomain.includes("rc")) {
      // RC environment with JWT
      url = `https://${apiDomain}/booker/jobs?company_id=${companyId}`;
      if (accountId) {
        url += `&account_id=${accountId}`;
      }
      headers = {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      };
    } else if (apiKey) {
      // Production with API key
      const accId = accountId || process.env.CORPORATE_DEFAULT_ACCOUNT_ID;
      url = `https://${apiDomain}/v2/jobs/listActive?api_key=${apiKey}&coid=${companyId}`;
      if (accId) {
        url += `&accid=${accId}`;
      }
    } else {
            return NextResponse.json(
        { success: false, error: "Missing TaxiCaller credentials" },
        { status: 500 }
            );
        }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("TaxiCaller jobs error:", res.status, errorText);
      return NextResponse.json(
        { success: false, error: "TaxiCaller request failed" },
        { status: 500 }
      );
    }

        const json = await res.json();

        return NextResponse.json({
            success: true,
      jobs: json.jobs || json.orders || [],
        });
    } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("TC live jobs error:", err);
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
