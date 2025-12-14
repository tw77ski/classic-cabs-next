// Skeleton Loading Components
// Beautiful skeleton loaders for a smoother loading experience

"use client";

import { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

// Base skeleton with shimmer animation
export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Text line skeleton
export function SkeletonText({
  lines = 1,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 rounded"
          style={{ width: i === lines - 1 && lines > 1 ? "70%" : "100%" }}
        />
      ))}
    </div>
  );
}

// Circle skeleton (for avatars)
export function SkeletonCircle({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Skeleton
      className={`rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// Card skeleton
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-[--bg-secondary] border border-[--border] rounded-xl p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <SkeletonCircle size={40} />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

// Table row skeleton
export function SkeletonTableRow({
  columns = 5,
  className = "",
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 py-3 px-4 ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 rounded"
          style={{ flex: i === 0 ? 2 : 1 }}
        />
      ))}
    </div>
  );
}

// Map skeleton
export function SkeletonMap({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-[--bg-tertiary] ${className}`} style={{ minHeight: 200 }}>
      {/* Fake map grid pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full" style={{
          backgroundImage: `
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }} />
      </div>
      {/* Shimmer overlay */}
      <div className="skeleton absolute inset-0" />
      {/* Fake route line */}
      <div className="absolute top-1/3 left-1/4 right-1/4 h-1 bg-[--accent] opacity-20 rounded-full" />
      {/* Fake markers */}
      <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-[--accent] rounded-full opacity-40" />
      <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-[--accent] rounded-full opacity-40" />
    </div>
  );
}

// Form input skeleton
export function SkeletonInput({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="h-3 w-16 rounded mb-2" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

// Button skeleton
export function SkeletonButton({
  className = "",
  width = "100%",
}: {
  className?: string;
  width?: string | number;
}) {
  return (
    <Skeleton
      className={`h-12 rounded-lg ${className}`}
      style={{ width }}
    />
  );
}

// Booking form skeleton (composite)
export function SkeletonBookingForm() {
  return (
    <div className="space-y-4">
      {/* Journey section */}
      <div className="bg-[--bg-secondary] p-4 rounded-xl border border-[--border] space-y-3">
        <Skeleton className="h-3 w-24 rounded" />
        <SkeletonInput />
        <SkeletonInput />
      </div>
      
      {/* Map skeleton */}
      <SkeletonMap className="h-48" />
      
      {/* Passenger section */}
      <div className="bg-[--bg-secondary] p-4 rounded-xl border border-[--border] space-y-3">
        <Skeleton className="h-3 w-32 rounded" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonInput />
          <SkeletonInput />
        </div>
        <SkeletonInput />
      </div>
      
      {/* Buttons */}
      <SkeletonButton />
      <SkeletonButton />
    </div>
  );
}

// History table skeleton
export function SkeletonHistoryTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-[--bg-secondary] rounded-xl border border-[--border] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 py-3 px-4 border-b border-[--border]">
        {[2, 1, 2, 2, 1, 1].map((flex, i) => (
          <Skeleton key={i} className="h-3 rounded" style={{ flex }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={6} />
      ))}
    </div>
  );
}

// Dashboard stats skeleton
export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-[--bg-secondary] p-5 rounded-xl border border-[--border]">
          <Skeleton className="h-2 w-20 rounded mb-2" />
          <Skeleton className="h-8 w-16 rounded mb-1" />
          <Skeleton className="h-2 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}


