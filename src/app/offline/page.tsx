// Offline Fallback Page
// Shown when user is offline and page isn't cached

"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0d0f0e] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Offline Icon */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#1b1b1b] border border-[#333] flex items-center justify-center">
          <svg 
            className="w-12 h-12 text-[#ffd55c]" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5"
          >
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
          </svg>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-[#f5f5f5] mb-2">
          You&apos;re Offline
        </h1>
        <p className="text-[#888] mb-6">
          It looks like you&apos;ve lost your internet connection. 
          Please check your connection and try again.
        </p>

        {/* Retry Button */}
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-[#ffd55c] text-black font-semibold rounded-lg hover:bg-[#ffcc33] transition flex items-center gap-2 mx-auto"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Try Again
        </button>

        {/* Tips */}
        <div className="mt-8 p-4 bg-[#1b1b1b] rounded-lg border border-[#333] text-left">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-2">While you&apos;re offline:</h3>
          <ul className="text-xs text-[#888] space-y-1">
            <li>• Previously viewed pages may still be available</li>
            <li>• Your bookings will sync when you&apos;re back online</li>
            <li>• Call us directly: <span className="text-[#ffd55c]">01534 XXXXXX</span></li>
          </ul>
        </div>

        {/* Logo */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[#555]">
          <svg className="w-5 h-5 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.9 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.3.5-.1 1.1.4 1.3l.5.2" />
            <circle cx="7" cy="17" r="2" />
            <circle cx="17" cy="17" r="2" />
          </svg>
          <span className="text-sm">Classic Cabs</span>
        </div>
      </div>
    </div>
  );
}

