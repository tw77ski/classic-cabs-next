// Corporate Layout Wrapper
// Client component that handles auth state and sidebar

"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import CorporateSidebar from "./CorporateSidebar";

interface CorporateLayoutProps {
  children: React.ReactNode;
}

export default function CorporateLayout({ children }: CorporateLayoutProps) {
  const pathname = usePathname();
  
  // IMPORTANT: Check if login page FIRST, before any hooks that might cause re-renders
  const isLoginPage = pathname?.includes("/login");

  // For login page, render children immediately without any session logic
  if (isLoginPage) {
    return <>{children}</>;
  }

  // For all other pages, use the authenticated layout
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}

// Separate component for authenticated pages
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && session?.user;

  // Handle redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated) {
      router.push("/corporate/login");
    }
  }, [status, isAuthenticated, router]);

  // Handle logout
  async function handleLogout() {
    try {
      await signOut({ redirect: false });
      router.push("/corporate/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  // Show loading while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0d0f0e" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#ffd55c]/30 border-t-[#ffd55c] rounded-full animate-spin" />
          <p className="text-[#888] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show nothing (redirect will happen)
  if (!isAuthenticated || !session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0d0f0e" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#ffd55c]/30 border-t-[#ffd55c] rounded-full animate-spin" />
          <p className="text-[#888] text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Build user and company from session
  const user = {
    id: session.user.id || "",
    name: session.user.name || "",
    email: session.user.email || "",
    role: (session.user as any).role || "USER",
  };

  const company = {
    id: String((session.user as any).taxiCallerCompanyId || ""),
    name: "Classic Cabs Jersey", // We could fetch this from DB if needed
    taxiCallerAccountId: (session.user as any).taxiCallerCompanyId || 0,
  };

  // Authenticated pages - show sidebar
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0d0f0e" }}>
      <CorporateSidebar
        user={user}
        company={company}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <main
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-[#0d0f0e]/95 backdrop-blur-sm border-b border-[#222] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[#f5f5f5] capitalize">
                {pathname?.split("/").pop()?.replace(/-/g, " ") || "Dashboard"}
              </h1>
              <p className="text-xs text-[#666]">{company.name}</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Quick Book Button */}
              <button
                onClick={() => router.push("/corporate/booking")}
                className="flex items-center gap-2 px-4 py-2 bg-[#ffd55c] text-black text-sm font-medium rounded-lg hover:bg-[#ffcc33] transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                New Booking
              </button>

              {/* User Menu */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#ffd55c]/20 flex items-center justify-center">
                  <span className="text-sm font-medium text-[#ffd55c]">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm text-[#f5f5f5]">{user.name}</p>
                  <p className="text-[10px] text-[#666] capitalize">{user.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
