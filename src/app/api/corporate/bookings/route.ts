// Corporate Bookings API - Create pending bookings and list bookings
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createPendingBooking, getCompanyBookings, type BookingStatus } from '@/lib/corporate/bookings';

// Get corporate session from cookie
async function getSessionFromCookie() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('corporate_session');
  if (!sessionCookie?.value) return null;
  
  try {
    return JSON.parse(decodeURIComponent(sessionCookie.value));
  } catch {
    return null;
  }
}

// POST - Create a new pending booking
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
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
    const booking = await createPendingBooking({
      companyId: Number(session.company.id),
      userId: Number(session.user.id),
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
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as BookingStatus | null;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    
    const bookings = await getCompanyBookings(
      Number(session.company.id),
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



