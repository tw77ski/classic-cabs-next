import { NextResponse } from "next/server";

export async function GET() {
  const companyId = process.env.TAXICALLER_COMPANY_ID;
  const apiDomain = process.env.TAXICALLER_API_DOMAIN;
  const apiKey = process.env.TAXICALLER_API_KEY;

  // Check if environment variables are set
  if (!companyId || !apiDomain || !apiKey) {
    return NextResponse.json({
      status: "error",
      message: "Missing environment variables",
      checks: {
        TAXICALLER_COMPANY_ID: !!companyId,
        TAXICALLER_API_DOMAIN: !!apiDomain,
        TAXICALLER_API_KEY: !!apiKey,
      },
    }, { status: 500 });
  }

  const url = `https://${apiDomain}/external/v1/companies/${companyId}`;

  console.log("🔍 Health check URL:", url);
  console.log("🔑 Company ID:", companyId);
  console.log("🔑 API Key exists:", !!apiKey);

  try {
    const res = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
        "X-Company-ID": companyId,
      },
    });

    const raw = await res.text();
    console.log("📥 Health check response:", raw);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { raw };
    }

    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      companyId,
      apiDomain,
      response: parsed,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Health check error:", err);
    return NextResponse.json({
      status: "error",
      error: errorMessage,
      companyId,
      apiDomain,
    }, { status: 500 });
  }
}


