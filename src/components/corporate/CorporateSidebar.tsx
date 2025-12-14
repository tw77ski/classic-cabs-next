// Corporate Sidebar Navigation
// Provides navigation for all corporate pages

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
}

interface SessionCompany {
  id: string;
  name: string;
  taxiCallerAccountId: number;
}

interface CorporateSidebarProps {
  user: SessionUser;
  company: SessionCompany;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  {
    href: "/corporate/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: "/corporate/booking",
    label: "New Booking",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    href: "/corporate/history",
    label: "Booking History",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    href: "/corporate/passengers",
    label: "Passengers",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

const adminItems = [
  {
    href: "/corporate/admin",
    label: "Admin Settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    adminOnly: true,
  },
];

export default function CorporateSidebar({
  user,
  company,
  onLogout,
  collapsed,
  onToggleCollapse,
}: CorporateSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/corporate/dashboard") {
      return pathname === "/corporate" || pathname === "/corporate/dashboard";
    }
    return pathname.startsWith(href);
  };

  const isAdmin = user.role === "admin" || user.role === "owner";

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#111] border-r border-[#222] z-40 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#222]">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <svg
              className="w-6 h-6 text-[#ffd55c]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.9 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.3.5-.1 1.1.4 1.3l.5.2" />
              <circle cx="7" cy="17" r="2" />
              <circle cx="17" cy="17" r="2" />
            </svg>
            <span className="text-sm font-semibold text-[#f5f5f5]">Classic Cabs</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-2 text-[#888] hover:text-[#ffd55c] hover:bg-[#1b1b1b] rounded-lg transition"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {collapsed ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1">
        {!collapsed && (
          <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-[#555]">
            Navigation
          </p>
        )}
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
              isActive(item.href)
                ? "bg-[#ffd55c]/10 text-[#ffd55c]"
                : "text-[#888] hover:text-[#f5f5f5] hover:bg-[#1b1b1b]"
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
            {!collapsed && <span className="text-sm">{item.label}</span>}
          </Link>
        ))}

        {/* Admin Section */}
        {isAdmin && (
          <>
            {!collapsed && (
              <p className="px-3 py-2 mt-4 text-[10px] uppercase tracking-wider text-[#555]">
                Admin
              </p>
            )}
            {adminItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                  isActive(item.href)
                    ? "bg-[#ffd55c]/10 text-[#ffd55c]"
                    : "text-[#888] hover:text-[#f5f5f5] hover:bg-[#1b1b1b]"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-[#222]">
        {/* Company Info */}
        {!collapsed && (
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-[#888] truncate">{company.name}</p>
            <p className="text-[10px] text-[#555]">Account #{company.taxiCallerAccountId}</p>
          </div>
        )}

        {/* User Info & Logout */}
        <div className={`flex items-center gap-2 px-3 py-2 ${collapsed ? "justify-center" : ""}`}>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#f5f5f5] truncate">{user.name}</p>
              <p className="text-[10px] text-[#666] truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={onLogout}
            className="p-2 text-[#888] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition flex-shrink-0"
            title="Sign out"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        {/* Back to Main Site */}
        <Link
          href="/"
          className={`flex items-center gap-2 px-3 py-2 text-[#666] hover:text-[#888] transition ${
            collapsed ? "justify-center" : ""
          }`}
          title="Back to main site"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {!collapsed && <span className="text-xs">Back to main site</span>}
        </Link>
      </div>
    </aside>
  );
}
