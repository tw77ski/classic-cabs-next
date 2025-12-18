// Corporate Login Page
// /corporate/login

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DemoUser {
  email: string;
  company: string;
  role: string;
}

export default function CorporateLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Demo mode state
  const [authMode, setAuthMode] = useState<'loading' | 'database' | 'demo'>('loading');
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);

  // Check auth mode on mount
  useEffect(() => {
    async function checkAuthStatus() {
      try {
        const res = await fetch('/api/corporate/auth/status');
        const data = await res.json();
        
        if (data.success) {
          setAuthMode(data.mode);
          setDemoUsers(data.demoUsers || []);
        }
      } catch {
        // Default to demo mode on error
        setAuthMode('demo');
      }
    }
    
    checkAuthStatus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/corporate/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Login failed. Please check your credentials.");
        return;
      }

      // Redirect to dashboard on success
      router.push("/corporate/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#0d0f0e" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <svg
              className="w-10 h-10 text-[#ffd55c]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.9 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.3.5-.1 1.1.4 1.3l.5.2" />
              <circle cx="7" cy="17" r="2" />
              <circle cx="17" cy="17" r="2" />
            </svg>
            <h1 className="text-2xl font-semibold text-[#f5f5f5]">Classic Cabs</h1>
          </div>
          <p className="text-sm text-[#888]">Corporate Portal</p>
        </div>

        {/* Login Form */}
        <div className="bg-[#1b1b1b] border border-[#333] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-[#f5f5f5] mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-[#888] mb-1 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="text-xs text-[#888] mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-2 bg-[#ffd55c] text-black font-semibold rounded-lg hover:bg-[#ffcc33] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#333] text-center">
            <p className="text-xs text-[#666]">
              Need an account?{" "}
              <a href="mailto:corporate@classiccabs.je" className="text-[#ffd55c] hover:underline">
                Contact us
              </a>
            </p>
          </div>
        </div>

        {/* Demo Hints - Only shown when NOT using database */}
        {authMode === 'demo' && demoUsers.length > 0 && (
          <div className="mt-6 bg-[#1b1b1b]/50 border border-[#333]/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <p className="text-xs font-medium text-[#888]">Demo Accounts</p>
            </div>
            
            <div className="space-y-2">
              {demoUsers.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword("demo123");
                  }}
                  className="w-full text-left px-3 py-2 bg-[#111]/50 border border-[#222] rounded-lg hover:border-[#ffd55c]/30 hover:bg-[#ffd55c]/5 transition group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#ccc] group-hover:text-[#f5f5f5] font-mono">{demo.email}</p>
                      <p className="text-[10px] text-[#666]">{demo.company} • {demo.role}</p>
                    </div>
                    <svg className="w-3 h-3 text-[#555] group-hover:text-[#ffd55c] transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
            
            <p className="text-[10px] text-[#555] mt-3 text-center">
              Password for all: <span className="font-mono text-[#888]">demo123</span>
            </p>
          </div>
        )}

        {/* Database mode indicator */}
        {authMode === 'database' && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-xs text-emerald-400">Connected to secure database</p>
            </div>
          </div>
        )}

        {/* Back to main site */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-[#666] hover:text-[#888] transition">
            ← Back to main site
          </Link>
        </div>
      </div>
    </div>
  );
}
