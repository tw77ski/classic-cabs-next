// Approve a corporate booking and dispatch to TaxiCaller
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBookingByRef, updateBookingStatus } from '@/lib/corporate/bookings';

// TaxiCaller config
const TC_DOMAIN = process.env.TAXICALLER_API_DOMAIN || 'api-rc.taxicaller.net';
const TC_COMPANY_ID = Number(process.env.TAXICALLER_COMPANY_ID) || 8284;

async function getJwt(): Promise<string> {
  const jwt = process.env.TAXICALLER_DEV_JWT || process.env.TAXICALLER_JWT;
  if (!jwt) throw new Error('TAXICALLER_JWT not configured');
  return jwt;
}

// Build TaxiCaller order payload
function buildOrderPayload(booking: {
  passengerName: string;
  passengerPhone: string;
  passengerEmail?: string;
  passengerCount: number;
  luggageCount: number;
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress: string;
  dropoffLat?: number;
  dropoffLng?: number;
  stops: { address: string; lat?: number; lng?: number }[];
  pickupTime: string;
  isAsap: boolean;
  vehicleType: string;
  notes?: string;
  costCentre?: string;
  poNumber?: string;
  flightNumber?: string;
}) {
  const pickupUnix = !booking.isAsap ? Math.floor(new Date(booking.pickupTime).getTime() / 1000) : 0;
  
  // Build notes
  const noteParts: string[] = [];
  if (booking.vehicleType === 'luxury') noteParts.push('Executive V-Class requested');
  else if (booking.vehicleType === 'multiseater') noteParts.push('Multi-seater vehicle requested');
  if (booking.flightNumber) noteParts.push(`Flight: ${booking.flightNumber}`);
  if (booking.costCentre) noteParts.push(`Cost Centre: ${booking.costCentre}`);
  if (booking.poNumber) noteParts.push(`PO: ${booking.poNumber}`);
  if (booking.notes) noteParts.push(booking.notes);
  const mergedNotes = noteParts.join(' • ');
  
  // Build route nodes
  const nodes: Array<{
    "@type": string;
    action: string;
    address: string;
    lat: number;
    lng: number;
    time: number;
    note: string;
  }> = [];
  
  // Pickup
  nodes.push({
    "@type": "address",
    action: "in",
    address: booking.pickupAddress,
    lat: booking.pickupLat || 0,
    lng: booking.pickupLng || 0,
    time: pickupUnix,
    note: mergedNotes,
  });
  
  // Intermediate stops
  for (const stop of booking.stops) {
    if (stop.address) {
      nodes.push({
        "@type": "address",
        action: "via",
        address: stop.address,
        lat: stop.lat || 0,
        lng: stop.lng || 0,
        time: 0,
        note: "",
      });
    }
  }
  
  // Dropoff
  nodes.push({
    "@type": "address",
    action: "out",
    address: booking.dropoffAddress,
    lat: booking.dropoffLat || 0,
    lng: booking.dropoffLng || 0,
    time: 0,
    note: "",
  });
  
  return {
    order: {
      company_id: TC_COMPANY_ID,
      provider_id: 0,
      items: [
        {
          "@type": "passengers",
          seq: 0,
          passenger: {
            name: booking.passengerName,
            phone: booking.passengerPhone,
            email: booking.passengerEmail || "",
          },
          client_id: 0,
          require: {
            seats: booking.passengerCount,
            wc: 0,
            bags: booking.luggageCount,
          },
          info: { all: mergedNotes },
          pay_info: [],
        },
      ],
      route: {
        meta: { dist: 0, est_dur: 0 },
        nodes,
        legs: [],
      },
      info: { all: mergedNotes },
    },
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params;
    
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    // Only admins can approve
    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Admin access required to approve bookings' }, { status: 403 });
    }
    
    // Get the booking
    const booking = await getBookingByRef(reference);
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }
    
    // Check if already processed
    if (booking.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Booking already ${booking.status}` },
        { status: 400 }
      );
    }
    
    // Check company match
    const userCompanyId = (session.user as any).taxiCallerCompanyId;
    if (booking.companyId !== userCompanyId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    
    // Dispatch to TaxiCaller
    console.log(`✅ Approving booking ${reference} - dispatching to TaxiCaller...`);
    
    const jwt = await getJwt();
    const orderPayload = buildOrderPayload(booking);
    
    const tcResponse = await fetch(`https://${TC_DOMAIN}/api/v1/booker/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(orderPayload),
    });
    
    const tcData = await tcResponse.json();
    
    if (!tcResponse.ok) {
      console.error('TaxiCaller dispatch failed:', tcData);
      return NextResponse.json(
        { success: false, error: tcData.message || 'Failed to dispatch to TaxiCaller' },
        { status: 500 }
      );
    }
    
    const taxicallerOrderId = tcData.order?.order_id || tcData.id;
    const taxicallerJobId = tcData.meta?.job_id;
    
    // Update booking status to approved
    // Note: approvedBy expects a number (legacy schema), but Auth.js uses string IDs
    // Using 0 as placeholder since the actual approver is tracked in session/audit
    const updatedBooking = await updateBookingStatus(reference, 'approved', {
      approvedBy: 0, // Legacy field - actual user tracked via session.user.id
      taxicallerOrderId: String(taxicallerOrderId),
      taxicallerJobId,
    });
    
    console.log(`✅ Booking ${reference} approved and dispatched (TaxiCaller: ${taxicallerOrderId})`);
    
    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      taxicaller: {
        orderId: taxicallerOrderId,
        jobId: taxicallerJobId,
      },
      message: 'Booking approved and dispatched',
    });
    
  } catch (error) {
    console.error('Error approving booking:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve booking' },
      { status: 500 }
    );
  }
}





