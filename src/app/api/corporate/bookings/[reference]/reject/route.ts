// Reject a corporate booking
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getBookingByRef, updateBookingStatus } from '@/lib/corporate/bookings';

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params;
    
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    // Only admins can reject
    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required to reject bookings' }, { status: 403 });
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
    if (booking.companyId !== Number(session.company.id)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    
    // Get rejection reason
    const body = await req.json().catch(() => ({}));
    const rejectionReason = body.reason || 'Rejected by admin';
    
    // Update booking status to rejected
    const updatedBooking = await updateBookingStatus(reference, 'rejected', {
      approvedBy: Number(session.user.id),
      rejectionReason,
    });
    
    console.log(`❌ Booking ${reference} rejected: ${rejectionReason}`);
    
    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      message: 'Booking rejected',
    });
    
  } catch (error) {
    console.error('Error rejecting booking:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reject booking' },
      { status: 500 }
    );
  }
}


