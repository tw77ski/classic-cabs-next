/**
 * TaxiCaller Booker API Test Harness
 * 
 * Run with: npx ts-node tools/test-booking.ts
 * Or: npx tsx tools/test-booking.ts
 * 
 * Make sure your .env file has:
 *   TAXICALLER_COMPANY_ID=8284
 *   TAXICALLER_API_KEY=your_api_key
 *   TAXICALLER_DEV_JWT=your_jwt_token
 *   TAXICALLER_API_DOMAIN=api-rc.taxicaller.net
 */

import "dotenv/config";

const API_DOMAIN = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
const COMPANY_ID = process.env.TAXICALLER_COMPANY_ID;
const API_KEY = process.env.TAXICALLER_API_KEY;
const JWT = process.env.TAXICALLER_DEV_JWT;

const url = `https://${API_DOMAIN}/api/v1/booker/order`;

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("🧪 TAXICALLER BOOKER API TEST HARNESS");
  console.log("═".repeat(60));

  // Check environment
  console.log("\n📋 Environment:");
  console.log(`   API Domain: ${API_DOMAIN}`);
  console.log(`   Company ID: ${COMPANY_ID || "❌ NOT SET"}`);
  console.log(`   API Key: ${API_KEY ? "✅ Present" : "❌ NOT SET"}`);
  console.log(`   JWT: ${JWT ? "✅ Present (" + JWT.substring(0, 20) + "...)" : "❌ NOT SET"}`);

  if (!COMPANY_ID || !API_KEY || !JWT) {
    console.error("\n❌ Missing required environment variables. Check your .env file.");
    process.exit(1);
  }

  // Build test payload
  const scheduledTime = new Date(Date.now() + 3600000); // 1 hour from now

  const payload = {
    company_id: Number(COMPANY_ID),
    pickup: {
      address: "Jersey Airport, St Peter, Jersey JE1 1BY",
      latitude: 49.20516,
      longitude: -2.194695,
      locationType: "address",
    },
    dropoff: {
      address: "Radisson Blu Waterfront Jersey, St Helier, Jersey JE2 3WF",
      latitude: 49.1858,
      longitude: -2.113,
      locationType: "address",
    },
    passengers: 2,
    luggage: 1,
    customer: {
      name: "Test Rider",
      phone: "+447700900123",
      email: "test@example.com",
    },
    when: {
      type: "scheduled",
      time: scheduledTime.toISOString(),
    },
    vehicle_type: "standard",
    bookingSource: "api",
    notes: "🧪 Test booking from CLI harness - please ignore",
  };

  console.log("\n" + "─".repeat(60));
  console.log("📤 PAYLOAD:");
  console.log("─".repeat(60));
  console.log(JSON.stringify(payload, null, 2));

  console.log("\n" + "─".repeat(60));
  console.log("📡 SENDING REQUEST...");
  console.log("─".repeat(60));
  console.log(`URL: ${url}`);

  try {
    const startTime = Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY!,
        "Authorization": `Bearer ${JWT}`,
      },
      body: JSON.stringify(payload),
    });

    const elapsed = Date.now() - startTime;
    const text = await response.text();

    console.log("\n" + "─".repeat(60));
    console.log("📥 RESPONSE:");
    console.log("─".repeat(60));
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Time: ${elapsed}ms`);
    console.log(`Headers:`);
    response.headers.forEach((value, key) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log(`\nBody:`);
    console.log(text);

    // Try to parse JSON
    try {
      const json = JSON.parse(text);
      console.log("\n📘 Parsed JSON:");
      console.log(JSON.stringify(json, null, 2));

      if (response.ok) {
        console.log("\n✅ SUCCESS!");
        console.log(`   Order ID: ${json.id || json.order_id || json.orderId || "N/A"}`);
        console.log(`   Status: ${json.status || "N/A"}`);
      } else {
        console.log("\n❌ API ERROR:");
        console.log(`   Message: ${json.message || json.error || "Unknown error"}`);
        if (json.errors) {
          console.log(`   Errors: ${JSON.stringify(json.errors)}`);
        }
      }
    } catch {
      console.log("\n⚠️ Response is not valid JSON");
      
      // Check for common issues
      if (text.includes("NullPointerException")) {
        console.log("🔴 DETECTED: NullPointerException - Missing required field in payload");
      }
      if (text.includes("<html") || text.includes("<!DOCTYPE")) {
        console.log("🔴 DETECTED: HTML error page - Service may be down or endpoint incorrect");
      }
    }

  } catch (error: any) {
    console.error("\n❌ FETCH ERROR:");
    console.error(`   ${error.message}`);
    
    if (error.code === "ENOTFOUND") {
      console.error("   → DNS lookup failed - check API domain");
    } else if (error.code === "ECONNREFUSED") {
      console.error("   → Connection refused - service may be down");
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("✅ TEST COMPLETE");
  console.log("═".repeat(60) + "\n");
}

main();













