// Corporate Dashboard Page
// /corporate/dashboard

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DashboardData {
  success: boolean;
  stats: {
    thisMonth: { totalJobs: number; totalSpend: number };
    lastMonth: { totalJobs: number; totalSpend: number };
  };
  recentBookings: Array<{
    id: string;
    passenger: string;
    pickup: string;
    dropoff: string;
    time: string;
    status: string;
  }>;
  upcomingBookings: Array<{
    id: string;
    passenger: string;
    pickup: string;
    dropoff: string;
    time: string;
  }>;
  company?: {
    name: string;
    accountId: number;
  };
  note?: string;
}

// Pending booking interface
interface PendingBooking {
  id: number;
  reference: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  passengerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: string;
  vehicleType: string;
}

// Status badge styling
function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending Approval', className: 'text-amber-400 bg-amber-500/10 border-amber-400/30' };
    case 'approved':
      return { label: 'Confirmed', className: 'text-emerald-400 bg-emerald-500/10 border-emerald-400/30' };
    case 'completed':
      return { label: 'Completed', className: 'text-blue-400 bg-blue-500/10 border-blue-400/30' };
    case 'rejected':
      return { label: 'Rejected', className: 'text-red-400 bg-red-500/10 border-red-400/30' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'text-gray-400 bg-gray-500/10 border-gray-400/30' };
    default:
      return { label: status, className: 'text-[#888] bg-[#333]/50' };
  }
}

export default function CorporateDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        // Fetch dashboard data and pending bookings in parallel
        const [dashboardRes, bookingsRes] = await Promise.all([
          fetch("/api/corporate/dashboard"),
          fetch("/api/corporate/bookings?limit=10"),
        ]);
        
        if (dashboardRes.status === 401 || bookingsRes.status === 401) {
          router.push("/corporate/login");
          return;
        }
        
        const dashboardJson = await dashboardRes.json();
        const bookingsJson = await bookingsRes.json();
        
        if (dashboardJson.success) {
          setData(dashboardJson);
        } else {
          setError(dashboardJson.error || "Failed to load dashboard");
        }
        
        if (bookingsJson.success && bookingsJson.bookings) {
          setPendingBookings(bookingsJson.bookings);
        }
      } catch (err) {
        console.error("Dashboard load error:", err);
        setError("Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    }
    
    loadDashboard();
  }, [router]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Welcome Banner Skeleton */}
        <div className="bg-gradient-to-r from-[#ffd55c]/10 to-transparent p-6 border border-[#ffd55c]/20 rounded-xl">
          <div className="skeleton h-6 w-40 rounded mb-2" />
          <div className="skeleton h-4 w-72 rounded" />
        </div>

        {/* Quick Actions Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#1b1b1b] p-4 border border-[#333] rounded-xl"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="skeleton w-10 h-10 rounded-lg mb-3" />
              <div className="skeleton h-4 w-20 rounded mb-1" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
          ))}
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#1b1b1b] p-5 border border-[#333] rounded-xl"
              style={{ animationDelay: `${i * 75}ms` }}
            >
              <div className="skeleton h-3 w-24 rounded mb-2" />
              <div className="skeleton h-8 w-16 rounded mb-2" />
              <div className="skeleton h-3 w-28 rounded" />
            </div>
          ))}
        </div>

        {/* Two Column Grid Skeleton */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-[#1b1b1b] p-5 border border-[#333] rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="skeleton h-4 w-36 rounded" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="p-3 bg-[#111] rounded-lg border border-[#222]">
                  <div className="flex justify-between mb-2">
                    <div className="skeleton h-4 w-24 rounded" />
                    <div className="skeleton h-5 w-20 rounded" />
                  </div>
                  <div className="skeleton h-3 w-full rounded" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1b1b1b] p-5 border border-[#333] rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 bg-[#111] rounded-lg border border-[#222]">
                  <div className="flex justify-between mb-2">
                    <div className="skeleton h-4 w-20 rounded" />
                    <div className="skeleton h-5 w-16 rounded" />
                  </div>
                  <div className="skeleton h-3 w-3/4 rounded mb-1" />
                  <div className="skeleton h-2 w-16 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <p className="text-red-400 mb-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-[#ffd55c] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const jobsChange = data && data.stats.lastMonth.totalJobs > 0
    ? ((data.stats.thisMonth.totalJobs - data.stats.lastMonth.totalJobs) / data.stats.lastMonth.totalJobs * 100).toFixed(0)
    : "0";
  const spendChange = data && data.stats.lastMonth.totalSpend > 0
    ? ((data.stats.thisMonth.totalSpend - data.stats.lastMonth.totalSpend) / data.stats.lastMonth.totalSpend * 100).toFixed(0)
    : "0";

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="glow-card bg-gradient-to-r from-[#ffd55c]/10 to-transparent p-6 border border-[#ffd55c]/20">
        <h2 className="text-xl font-semibold text-[#f5f5f5] mb-1">
          Welcome back{data?.company?.name ? `, ${data.company.name}` : ''}!
        </h2>
        <p className="text-sm text-[#888]">Here&apos;s an overview of your corporate account activity.</p>
        {data?.note && (
          <p className="text-xs text-[#666] mt-2 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            {data.note}
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link href="/corporate/booking" className="glow-card bg-[#1b1b1b] p-4 border border-[#333] hover:border-[#ffd55c]/50 transition group">
          <div className="w-10 h-10 rounded-lg bg-[#ffd55c]/10 flex items-center justify-center mb-3 group-hover:bg-[#ffd55c]/20 transition">
            <svg className="w-5 h-5 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#f5f5f5]">New Booking</p>
          <p className="text-[10px] text-[#666]">Book a ride</p>
        </Link>

        <Link href="/corporate/history" className="glow-card bg-[#1b1b1b] p-4 border border-[#333] hover:border-[#ffd55c]/50 transition group">
          <div className="w-10 h-10 rounded-lg bg-[#ffd55c]/10 flex items-center justify-center mb-3 group-hover:bg-[#ffd55c]/20 transition">
            <svg className="w-5 h-5 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#f5f5f5]">View History</p>
          <p className="text-[10px] text-[#666]">Past bookings</p>
        </Link>

        <Link href="/corporate/passengers" className="glow-card bg-[#1b1b1b] p-4 border border-[#333] hover:border-[#ffd55c]/50 transition group">
          <div className="w-10 h-10 rounded-lg bg-[#ffd55c]/10 flex items-center justify-center mb-3 group-hover:bg-[#ffd55c]/20 transition">
            <svg className="w-5 h-5 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#f5f5f5]">Passengers</p>
          <p className="text-[10px] text-[#666]">Manage list</p>
        </Link>

        <Link href="/corporate/history?export=pdf" className="glow-card bg-[#1b1b1b] p-4 border border-[#333] hover:border-[#ffd55c]/50 transition group">
          <div className="w-10 h-10 rounded-lg bg-[#ffd55c]/10 flex items-center justify-center mb-3 group-hover:bg-[#ffd55c]/20 transition">
            <svg className="w-5 h-5 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#f5f5f5]">Export PDF</p>
          <p className="text-[10px] text-[#666]">Download report</p>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glow-card bg-[#1b1b1b] p-5 border border-[#333]">
          <p className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Jobs This Month</p>
          <p className="text-2xl font-bold text-[#f5f5f5]">{data?.stats.thisMonth.totalJobs || 0}</p>
          {data?.stats.lastMonth.totalJobs !== undefined && data.stats.lastMonth.totalJobs > 0 && (
            <p className={`text-xs mt-1 ${Number(jobsChange) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {Number(jobsChange) >= 0 ? '↑' : '↓'} {Math.abs(Number(jobsChange))}% vs last month
            </p>
          )}
        </div>

        <div className="glow-card bg-[#1b1b1b] p-5 border border-[#333]">
          <p className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Spend This Month</p>
          <p className="text-2xl font-bold text-[#ffd55c]">£{(data?.stats.thisMonth.totalSpend || 0).toFixed(2)}</p>
          {data?.stats.lastMonth.totalSpend !== undefined && data.stats.lastMonth.totalSpend > 0 && (
            <p className={`text-xs mt-1 ${Number(spendChange) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {Number(spendChange) >= 0 ? '↑' : '↓'} {Math.abs(Number(spendChange))}% vs last month
            </p>
          )}
        </div>

        <div className="glow-card bg-[#1b1b1b] p-5 border border-[#333]">
          <p className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-400">
            {pendingBookings.filter(b => b.status === 'pending').length}
          </p>
          <p className="text-xs text-[#666] mt-1">Awaiting approval</p>
        </div>

        <div className="glow-card bg-[#1b1b1b] p-5 border border-[#333]">
          <p className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Avg. per Job</p>
          <p className="text-2xl font-bold text-[#f5f5f5]">
            £{data && data.stats.thisMonth.totalJobs > 0 
              ? (data.stats.thisMonth.totalSpend / data.stats.thisMonth.totalJobs).toFixed(2) 
              : '0.00'}
          </p>
          <p className="text-xs text-[#666] mt-1">This month</p>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Bookings */}
        <div className="glow-card bg-[#1b1b1b] p-5 border border-[#333]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#f5f5f5] flex items-center gap-2">
              <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Upcoming Bookings
            </h3>
            <Link href="/corporate/history?status=upcoming" className="text-[10px] text-[#ffd55c] hover:underline">
              View all →
            </Link>
          </div>
          
          {!data?.upcomingBookings || data.upcomingBookings.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-[#333] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p className="text-sm text-[#666]">No upcoming bookings</p>
              <Link href="/corporate/booking" className="text-xs text-[#ffd55c] hover:underline mt-2 inline-block">
                Book a ride →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.upcomingBookings.map((booking) => (
                <div key={booking.id} className="p-3 bg-[#111] rounded-lg border border-[#222] hover:border-[#333] transition">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#f5f5f5]">{booking.passenger}</span>
                    <span className="text-[10px] text-[#ffd55c] bg-[#ffd55c]/10 px-2 py-0.5 rounded font-medium">
                      {booking.time}
                    </span>
                  </div>
                  <p className="text-xs text-[#888] truncate flex items-center gap-1">
                    <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                    {booking.pickup}
                  </p>
                  <p className="text-xs text-[#888] truncate flex items-center gap-1 mt-0.5">
                    <svg className="w-3 h-3 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                    {booking.dropoff}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity / Pending Bookings */}
        <div className="glow-card bg-[#1b1b1b] p-5 border border-[#333]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#f5f5f5] flex items-center gap-2">
              <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Your Bookings
              {pendingBookings.filter(b => b.status === 'pending').length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-[10px] font-medium text-amber-400 bg-amber-500/10 rounded-full border border-amber-400/30">
                  {pendingBookings.filter(b => b.status === 'pending').length} pending
                </span>
              )}
            </h3>
            <Link href="/corporate/history" className="text-[10px] text-[#ffd55c] hover:underline">
              View all →
            </Link>
          </div>

          {pendingBookings.length === 0 && (!data?.recentBookings || data.recentBookings.length === 0) ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-[#333] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p className="text-sm text-[#666]">No bookings yet</p>
              <Link href="/corporate/booking" className="text-xs text-[#ffd55c] hover:underline mt-2 inline-block">
                Make your first booking →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Show pending bookings from our system first */}
              {pendingBookings.slice(0, 5).map((booking) => {
                const badge = getStatusBadge(booking.status);
                return (
                  <div key={booking.reference} className="p-3 bg-[#111] rounded-lg border border-[#222] hover:border-[#333] transition">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[#f5f5f5]">{booking.passengerName}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#888] truncate">
                      {booking.pickupAddress} → {booking.dropoffAddress}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-[#555]">
                        {new Date(booking.pickupTime).toLocaleDateString('en-GB', { 
                          weekday: 'short', 
                          day: 'numeric', 
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <p className="text-[10px] text-[#666] font-mono">{booking.reference}</p>
                    </div>
                  </div>
                );
              })}
              
              {/* Show recent TaxiCaller bookings if no pending bookings */}
              {pendingBookings.length === 0 && data?.recentBookings.map((booking) => {
                const badge = getStatusBadge(booking.status.toLowerCase());
                return (
                  <div key={booking.id} className="p-3 bg-[#111] rounded-lg border border-[#222] hover:border-[#333] transition">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[#f5f5f5]">{booking.passenger}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#888] truncate">
                      {booking.pickup} → {booking.dropoff}
                    </p>
                    <p className="text-[10px] text-[#555] mt-1">{booking.time}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Pending Approvals Alert - Show if there are pending bookings */}
      {pendingBookings.filter(b => b.status === 'pending').length > 0 && (
        <div className="glow-card bg-amber-500/5 p-4 border border-amber-500/20 rounded-xl flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">
              {pendingBookings.filter(b => b.status === 'pending').length} booking(s) awaiting approval
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Your bookings are being reviewed and will be confirmed shortly
            </p>
          </div>
        </div>
      )}

      {/* Quick Book CTA */}
      <div className="glow-card bg-gradient-to-r from-[#1b1b1b] to-[#222] p-6 border border-[#333] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#f5f5f5] mb-1">Need a ride?</h3>
          <p className="text-sm text-[#888]">Book now and charge to your corporate account</p>
        </div>
        <Link
          href="/corporate/booking"
          className="px-6 py-3 bg-[#ffd55c] text-black font-semibold rounded-lg hover:bg-[#ffcc33] transition flex items-center gap-2 whitespace-nowrap"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          Book Now
        </Link>
      </div>
    </div>
  );
}
