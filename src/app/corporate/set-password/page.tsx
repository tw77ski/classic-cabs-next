// Set Password Page - For invited users
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid or missing invite token");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/corporate/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to set password");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/corporate/login"), 2000);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#0d0f0e" }}>
        <div className="w-full max-w-md text-center">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Invalid Link</h2>
            <p className="text-sm text-[#888] mb-4">
              This invite link is invalid or has expired.
            </p>
            <Link
              href="/corporate/login"
              className="text-sm text-[#ffd55c] hover:underline"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#0d0f0e" }}>
        <div className="w-full max-w-md text-center">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
            <svg className="w-12 h-12 text-green-400 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <h2 className="text-lg font-semibold text-green-400 mb-2">Password Set!</h2>
            <p className="text-sm text-[#888]">
              Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#0d0f0e" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <svg className="w-10 h-10 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.9 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.3.5-.1 1.1.4 1.3l.5.2" />
              <circle cx="7" cy="17" r="2" />
              <circle cx="17" cy="17" r="2" />
            </svg>
            <h1 className="text-2xl font-semibold text-[#f5f5f5]">Classic Cabs</h1>
          </div>
          <p className="text-sm text-[#888]">Set Your Password</p>
        </div>

        {/* Form */}
        <div className="bg-[#1b1b1b] border border-[#333] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-[#f5f5f5] mb-2">Welcome!</h2>
          <p className="text-sm text-[#666] mb-6">
            You&apos;ve been invited to Classic Cabs Corporate Portal. Please set your password to continue.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-[#888] mb-1 block">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div>
              <label className="text-xs text-[#888] mb-1 block">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                placeholder="Re-enter password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-2 bg-[#ffd55c] text-black font-semibold rounded-lg hover:bg-[#ffcc33] transition disabled:opacity-50"
            >
              {isLoading ? "Setting Password..." : "Set Password & Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0d0f0e" }}>
        <div className="w-10 h-10 border-3 border-[#ffd55c]/30 border-t-[#ffd55c] rounded-full animate-spin" />
      </div>
    }>
      <SetPasswordForm />
    </Suspense>
  );
}
