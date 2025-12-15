"use client";

import dynamic from "next/dynamic";
import { ComponentType, Suspense } from "react";

// =============================================================================
// Loading Skeletons for lazy components
// =============================================================================

function MapLoadingSkeleton() {
  return (
    <div className="relative rounded-xl overflow-hidden bg-[#1a1f1e] h-full min-h-[240px]">
      {/* Skeleton grid pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `
          linear-gradient(#c9a962 1px, transparent 1px),
          linear-gradient(90deg, #c9a962 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }} />
      {/* Shimmer overlay */}
      <div className="absolute inset-0 skeleton" />
      {/* Loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#c9a962]/30 border-t-[#c9a962] rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-[#666]">Loading map...</p>
        </div>
      </div>
    </div>
  );
}

function FormLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-4 w-24 rounded" />
      <div className="skeleton h-10 w-full rounded-lg" />
      <div className="skeleton h-10 w-full rounded-lg" />
    </div>
  );
}

function DateTimeLoadingSkeleton() {
  return (
    <div className="space-y-2">
      <div className="skeleton h-3 w-20 rounded" />
      <div className="flex gap-2">
        <div className="skeleton h-10 flex-1 rounded-lg" />
        <div className="skeleton h-10 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

// =============================================================================
// Lazy loaded components
// =============================================================================

// MapPreview - Heavy component with Mapbox GL
export const LazyMapPreview = dynamic(
  () => import("@/app/components/MapPreview"),
  {
    loading: () => <MapLoadingSkeleton />,
    ssr: false, // Mapbox doesn't work on server
  }
);

// DateTimeInput - Medium weight component
export const LazyDateTimeInput = dynamic(
  () => import("@/app/components/DateTimeInput"),
  {
    loading: () => <DateTimeLoadingSkeleton />,
    ssr: true,
  }
);

// JourneyForm - Medium weight component with autocomplete
export const LazyJourneyForm = dynamic(
  () => import("@/app/components/JourneyForm"),
  {
    loading: () => <FormLoadingSkeleton />,
    ssr: true,
  }
);

// FrequentTravelerSelect - Corporate feature
export const LazyFrequentTravelerSelect = dynamic(
  () => import("@/app/components/FrequentTravelerSelect"),
  {
    loading: () => <div className="skeleton h-10 w-full rounded-lg" />,
    ssr: false,
  }
);

// MultiPassengerForm - Corporate feature
export const LazyMultiPassengerForm = dynamic(
  () => import("@/app/components/MultiPassengerForm"),
  {
    loading: () => <FormLoadingSkeleton />,
    ssr: false,
  }
);

// PDF Export (jsPDF is heavy)
export const LazyPDFExport = dynamic(
  () => import("jspdf").then((mod) => {
    // Return a dummy component that exposes jsPDF
    const Wrapper: ComponentType<{ onReady: (jsPDF: typeof mod.jsPDF) => void }> = ({ onReady }) => {
      onReady(mod.jsPDF);
      return null;
    };
    return Wrapper;
  }),
  { ssr: false }
);

// =============================================================================
// Suspense wrapper for lazy components
// =============================================================================

interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function LazyWrapper({ children, fallback }: LazyWrapperProps) {
  return (
    <Suspense fallback={fallback || <div className="skeleton h-32 rounded-lg" />}>
      {children}
    </Suspense>
  );
}

// =============================================================================
// Preload function for critical components
// =============================================================================

export function preloadMapPreview() {
  // Trigger the dynamic import early
  import("@/app/components/MapPreview");
}

export function preloadJourneyForm() {
  import("@/app/components/JourneyForm");
}

