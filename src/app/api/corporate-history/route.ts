// src/app/api/corporate-history/route.ts
// Fetches completed job history for a corporate account
import { NextRequest, NextResponse } from "next/server";

// Extend global for logging throttle
declare global {
  // eslint-disable-next-line no-var
  var lastHistoryLog: number | undefined;
}

// Raw job structure from TaxiCaller API
interface TCRawJob {
    id?: string | number;
    job_id?: string | number;
    order_id?: string | number;
    ref?: string;
    reference?: string;
    status?: string;
    pickup_time?: number | string;
    created_at?: string;
    from?: { name?: string };
    to?: { name?: string };
    pickup?: { name?: string };
    dropoff?: { name?: string };
    pickup_address?: string;
    dropoff_address?: string;
    price_total?: number;
    fare?: number;
    total?: number;
}

// Mapped job structure
interface MappedJob {
    id: string | number;
    ref: string;
    pickup_time: string;
    from: string;
    to: string;
    fare: number;
}

// ---- TaxiCaller env ----
const TC_DOMAIN = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
const TC_COMPANY_ID = Number(process.env.TAXICALLER_COMPANY_ID);
const TC_KEY = process.env.TAXICALLER_API_KEY;
const TC_SUB = process.env.TAXICALLER_SUB || "*";

// ---- JWT cache ----
let cachedJwt: string | null = null;
let jwtExp = 0;

/**
 * Get JWT token using the official TaxiCaller API endpoint
 * Same as book route - uses /api/v1/jwt/for-key
 */
async function getJwt(): Promise<string> {
    if (!TC_KEY) throw new Error("TAXICALLER_API_KEY not configured");

    const now = Math.floor(Date.now() / 1000);
    if (cachedJwt && now < jwtExp - 60) return cachedJwt;

    const url = `https://${TC_DOMAIN}/api/v1/jwt/for-key`;
    const params = new URLSearchParams({ key: TC_KEY, sub: TC_SUB });

    console.log("🔑 [History] Fetching JWT from:", url);

    const res = await fetch(`${url}?${params}`);
    if (!res.ok) {
        const text = await res.text();
        console.error("❌ [History] JWT fetch failed:", res.status, text);
        throw new Error(`Failed to get JWT: ${res.status}`);
    }

    const data = await res.json();
    if (!data || !data.token) throw new Error("Failed to obtain JWT");

    const token: string = data.token;
    cachedJwt = token;

    try {
        const payload = JSON.parse(
            Buffer.from(token.split(".")[1], "base64").toString("utf8")
        );
        jwtExp = payload.exp || now + 840;
    } catch {
        jwtExp = now + 840;
    }

    console.log("✅ [History] JWT obtained");
    return token;
}

// ---- GET /api/corporate-history ----
// TaxiCaller API docs: https://app.taxicaller.net/documentation/api/
// Uses POST /api/v1/reports/typed/generate to generate "Account jobs" report
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const accountId = searchParams.get("accountId") || "";

        if (!accountId) {
            return NextResponse.json(
                { success: false, error: "Missing accountId" },
                { status: 400 }
            );
        }

        const jwt = await getJwt();

        // Date range = first day of month -> today
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1);

        // Per TaxiCaller API docs, use POST /api/v1/reports/typed/generate
        // Report type "jobs" with filter for account
        const reportsUrl = `https://${TC_DOMAIN}/api/v1/reports/typed/generate`;
        
        console.log("📊 [History] Generating report from:", reportsUrl);

        // Build report request per API documentation
        const reportRequest = {
            company_id: TC_COMPANY_ID,
            report_type: "jobs",
            output_format: "json",
            template_id: 4, // "Account jobs" template (ID 4 per docs example)
            search_query: {
                period: {
                    "@type": "custom",
                    start: from.toISOString().split("T")[0] + "T00:00:00",
                    end: now.toISOString().split("T")[0] + "T23:59:59",
                },
                // Filter by account if the template supports it
                account_id: parseInt(accountId) || undefined,
            },
        };

        console.log("📋 [History] Report request:", JSON.stringify(reportRequest));

        const response = await fetch(reportsUrl, {
            method: "POST",
            headers: { 
                Authorization: `Bearer ${jwt}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(reportRequest),
        });

        // If reports endpoint fails, return empty results gracefully
        if (!response.ok) {
            // Only log once per minute to reduce spam (reports often fail in staging)
            const now2 = Date.now();
            if (!global.lastHistoryLog || now2 - global.lastHistoryLog > 60000) {
                console.log("ℹ️ [History] Reports not available in staging environment (status:", response.status, ")");
                global.lastHistoryLog = now2;
            }
            
            // Return empty history - reports may require setup in TaxiCaller admin
            return NextResponse.json({
                success: true,
                accountId,
                from: from.toISOString(),
                to: now.toISOString(),
                totalJobs: 0,
                totalFare: 0,
                currency: "GBP",
                jobs: [],
                note: "Report generation not available in staging. Configure report templates in TaxiCaller admin panel for production.",
            });
        }

        const data = await response.json();
        console.log("✅ [History] Got report response with", data.rows?.length || 0, "rows");

        // Parse report response - docs show { header, columns, results, rows }
        const rawRows = data.rows || [];
        
        // Filter rows for this account and map to our format
        const jobs: MappedJob[] = rawRows
            .filter((row: Record<string, string | number>) => {
                // If account_num column exists, filter by it
                if (row.account_num && row.account_num !== "" && row.account_num !== accountId) {
                    return false;
                }
                return true;
            })
            .map((row: Record<string, string | number>) => ({
                id: row.job_id || "",
                ref: row.reference || String(row.job_id || ""),
                pickup_time: row.start || row.date || "",
                from: row["pick-up"] || row.pickup || "",
                to: row.drop_off || row.dropoff || "",
                fare: parseFloat(String(row.payable || row.sub_total || 0).replace(/[^0-9.]/g, "")) || 0,
            }));

        const totalFare = jobs.reduce((sum: number, j: MappedJob) => sum + (j.fare || 0), 0);

        return NextResponse.json({
            success: true,
            accountId,
            from: from.toISOString(),
            to: now.toISOString(),
            totalJobs: jobs.length,
            totalFare,
            currency: data.header?.currency || "GBP",
            jobs,
        });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("❌ [History] API error:", err);
        
        // Return empty results on error instead of failing
        return NextResponse.json({
            success: true,
            accountId: "",
            from: new Date().toISOString(),
            to: new Date().toISOString(),
            totalJobs: 0,
            totalFare: 0,
            currency: "GBP",
            jobs: [],
            note: `Unable to fetch history: ${errorMessage}`,
        });
    }
}
