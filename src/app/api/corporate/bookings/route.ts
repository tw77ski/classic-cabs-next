// Corporate Bookings API - Create pending bookings and list bookings
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createPendingBooking, getCompanyBookings, type BookingStatus } from '@/lib/corporate/bookings';

// POST - Create a new pending booking
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const body = await req.json();
    
    // Validate required fields
    if (!body.passengerName || !body.passengerPhone || !body.pickupAddress || !body.dropoffAddress || !body.pickupTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: passengerName, passengerPhone, pickupAddress, dropoffAddress, pickupTime' },
        { status: 400 }
      );
    }
    
    // Create pending booking (NOT dispatched to TaxiCaller yet)
    // Note: userId expects number (legacy schema), but Auth.js uses string IDs
    const booking = await createPendingBooking({
      companyId: (session.user as any).taxiCallerCompanyId || 0,
      userId: 0, // Legacy field - actual user tracked via session
      passengerName: body.passengerName,
      passengerPhone: body.passengerPhone,
      passengerEmail: body.passengerEmail,
      passengerCount: body.passengerCount || 1,
      luggageCount: body.luggageCount || 0,
      pickupAddress: body.pickupAddress,
      pickupLat: body.pickupLat,
      pickupLng: body.pickupLng,
      dropoffAddress: body.dropoffAddress,
      dropoffLat: body.dropoffLat,
      dropoffLng: body.dropoffLng,
      stops: body.stops || [],
      pickupTime: body.pickupTime,
      isAsap: body.isAsap || false,
      vehicleType: body.vehicleType || 'standard',
      notes: body.notes,
      costCentre: body.costCentre,
      poNumber: body.poNumber,
      contactPerson: body.contactPerson,
      flightNumber: body.flightNumber,
    });
    
    console.log(`📋 Corporate booking created (PENDING): ${booking.reference}`);
    
    return NextResponse.json({
      success: true,
      booking: {
        reference: booking.reference,
        status: booking.status,
        pickupTime: booking.pickupTime,
        passengerName: booking.passengerName,
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
      },
      message: 'Booking submitted for approval',
    });
    
  } catch (error) {
    console.error('Error creating corporate booking:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}

// GET - List bookings for the company
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as BookingStatus | null;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    
    const companyId = (session.user as any).taxiCallerCompanyId || 0;
    const bookings = await getCompanyBookings(
      companyId,
      { status: status || undefined, limit }
    );
    
    return NextResponse.json({
      success: true,
      bookings,
      total: bookings.length,
    });
    
  } catch (error) {
    console.error('Error fetching corporate bookings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}





