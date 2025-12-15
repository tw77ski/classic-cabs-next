// Corporate Dashboard Page
// /corporate/dashboard

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DashboardData {
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
}

export default function CorporateDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading dashboard data
    // In production, fetch from /api/corporate/dashboard
    setTimeout(() => {
      setData({
        stats: {
          thisMonth: { totalJobs: 24, totalSpend: 847.50 },
          lastMonth: { totalJobs: 18, totalSpend: 632.00 },
        },
        recentBookings: [
          { id: "1", passenger: "John Smith", pickup: "Jersey Airport", dropoff: "Radisson Blu", time: "Today 14:30", status: "completed" },
          { id: "2", passenger: "Sarah Jones", pickup: "Merton Hotel", dropoff: "Jersey Airport", time: "Today 09:15", status: "completed" },
          { id: "3", passenger: "Mike Brown", pickup: "St Helier", dropoff: "Gorey", time: "Yesterday", status: "completed" },
        ],
        upcomingBookings: [
          { id: "4", passenger: "Emma Wilson", pickup: "Jersey Airport", dropoff: "Grand Hotel", time: "Tomorrow 16:00" },
          { id: "5", passenger: "James Davis", pickup: "Radisson Blu", dropoff: "Jersey Airport", time: "Fri 08:30" },
        ],
      });
      setIsLoading(false);
    }, 500);
  }, []);

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
          {/* Upcoming Bookings Skeleton */}
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

          {/* Recent Activity Skeleton */}
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

  const jobsChange = data ? ((data.stats.thisMonth.totalJobs - data.stats.lastMonth.totalJobs) / data.stats.lastMonth.totalJobs * 100).toFixed(0) : 0;
  const spendChange = data ? ((data.stats.thisMonth.totalSpend - data.stats.lastMonth.totalSpend) / data.stats.lastMonth.totalSpend * 100).toFixed(0) : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="glow-card bg-gradient-to-r from-[#ffd55c]/10 to-transparent p-6 border border-[#ffd55c]/20">
        <h2 className="text-xl font-semibold text-[#f5f5f5] mb-1">Welcome back!</h2>
        <p className="text-sm text-[#888]">Here&apos;s an overview of your corporate account activity.</p>
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

        <button className="glow-card bg-[#1b1b1b] p-4 border border-[#333] hover:border-[#ffd55c]/50 transition group text-left">
          <div className="w-10 h-10 rounded-lg bg-[#ffd55c]/10 flex items-center justify-center mb-3 group-hover:bg-[#ffd55c]/20 transition">
            <svg className="w-5 h-5 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#f5f5f5]">Export PDF</p>
          <p className="text-[10px] text-[#666]">Download report</p>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glow-card bg-[#1b1b1b] p-5 border border-[#333]">
          <p className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Jobs This Month</p>
          <p className="text-2xl font-bold text-[#f5f5f5]">{data?.stats.thisMonth.totalJobs}</p>
          <p className={`text-xs mt-1 ${Number(jobsChange) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {Number(jobsChange) >= 0 ? '↑' : '↓'} {Math.abs(Number(jobsChange))}% vs last month
          </p>
        </div>

        <div className="glow-card bg-[#1b1b1b] p-5 border border-[#333]">
          <p className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Spend This Month</p>
          <p className="text-2xl font-bold text-[#ffd55c]">£{data?.stats.thisMonth.totalSpend.toFixed(2)}</p>
          <p className={`text-xs mt-1 ${Number(spendChange) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {Number(spendChange) >= 0 ? '↑' : '↓'} {Math.abs(Number(spendChange))}% vs last month
          </p>
        </div>

        <div className="glow-card bg-[#1b1b1b] p-5 border border-[#333]">
          <p className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Upcoming</p>
          <p className="text-2xl font-bold text-[#f5f5f5]">{data?.upcomingBookings.length || 0}</p>
          <p className="text-xs text-[#666] mt-1">Scheduled rides</p>
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
            <h3 className="text-sm font-semibold text-[#f5f5f5]">Upcoming Bookings</h3>
            <Link href="/corporate/history?status=upcoming" className="text-[10px] text-[#ffd55c] hover:underline">
              View all →
            </Link>
          </div>
          
          {data?.upcomingBookings.length === 0 ? (
            <p className="text-sm text-[#666] py-4 text-center">No upcoming bookings</p>
          ) : (
            <div className="space-y-3">
              {data?.upcomingBookings.map((booking) => (
                <div key={booking.id} className="p-3 bg-[#111] rounded-lg border border-[#222]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#f5f5f5]">{booking.passenger}</span>
                    <span className="text-[10px] text-[#ffd55c] bg-[#ffd55c]/10 px-2 py-0.5 rounded">
                      {booking.time}
                    </span>
                  </div>
                  <p className="text-xs text-[#888] truncate">
                    {booking.pickup} → {booking.dropoff}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="glow-card bg-[#1b1b1b] p-5 border border-[#333]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#f5f5f5]">Recent Activity</h3>
            <Link href="/corporate/history" className="text-[10px] text-[#ffd55c] hover:underline">
              View all →
            </Link>
          </div>

          {data?.recentBookings.length === 0 ? (
            <p className="text-sm text-[#666] py-4 text-center">No recent bookings</p>
          ) : (
            <div className="space-y-3">
              {data?.recentBookings.map((booking) => (
                <div key={booking.id} className="p-3 bg-[#111] rounded-lg border border-[#222]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#f5f5f5]">{booking.passenger}</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {booking.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#888] truncate">
                    {booking.pickup} → {booking.dropoff}
                  </p>
                  <p className="text-[10px] text-[#555] mt-1">{booking.time}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




