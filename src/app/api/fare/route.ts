import { NextResponse } from "next/server";
import { getFareEstimate } from "@/lib/taxicaller";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      stops = [],
      asap,
      pickupTimeUnix,
    } = body;

    // Validate required fields
    if (!pickupAddress || !dropoffAddress) {
      return NextResponse.json(
        { error: "Pickup and dropoff addresses are required" },
        { status: 400 }
      );
    }

    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      return NextResponse.json(
        { error: "Coordinates are required for fare calculation" },
        { status: 400 }
      );
    }

    const result = await getFareEstimate({
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      stops,
      asap,
      pickupTimeUnix,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fare route error:", error);
    return NextResponse.json(
      { error: "Failed to get fare estimate", details: String(error) },
      { status: 500 }
    );
  }
}
