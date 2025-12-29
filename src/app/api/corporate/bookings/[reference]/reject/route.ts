// Reject a corporate booking
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBookingByRef, updateBookingStatus } from '@/lib/corporate/bookings';

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
    
    // Only admins can reject
    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN') {
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
    const userCompanyId = (session.user as any).taxiCallerCompanyId;
    if (booking.companyId !== userCompanyId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    
    // Get rejection reason
    const body = await req.json().catch(() => ({}));
    const rejectionReason = body.reason || 'Rejected by admin';
    
    // Update booking status to rejected
    // Note: approvedBy expects a number (legacy schema), but Auth.js uses string IDs
    const updatedBooking = await updateBookingStatus(reference, 'rejected', {
      approvedBy: 0, // Legacy field - actual user tracked via session.user.id
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
