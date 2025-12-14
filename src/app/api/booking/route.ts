import { NextResponse } from "next/server";
import { createBooking } from "@/lib/taxicaller";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      passengerName,
      passengerPhone,
      passengerEmail,
      seats,
      bags,
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      stops = [],
      asap,
      pickupTimeUnix,
      notes,
      returnTrip,
      returnTimeUnix,
    } = body;

    // Validate required fields
    if (!passengerName || !passengerPhone) {
      return NextResponse.json(
        { error: "Passenger name and phone are required" },
        { status: 400 }
      );
    }

    if (!pickupAddress || !dropoffAddress) {
      return NextResponse.json(
        { error: "Pickup and dropoff addresses are required" },
        { status: 400 }
      );
    }

    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      return NextResponse.json(
        { error: "Coordinates are required for booking" },
        { status: 400 }
      );
    }

    const result = await createBooking({
      passengerName,
      passengerPhone,
      passengerEmail,
      seats,
      bags,
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      stops,
      asap,
      pickupTimeUnix,
      notes,
      returnTrip,
      returnTimeUnix,
    });

    return NextResponse.json({
      success: true,
      message: "Booking created successfully",
      booking: result,
    });
  } catch (error) {
    console.error("Booking route error:", error);
    return NextResponse.json(
      { error: "Failed to create booking", details: String(error) },
      { status: 500 }
    );
  }
}
