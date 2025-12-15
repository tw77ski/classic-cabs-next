// Corporate Booking History Page
// /corporate/history
// Full booking history with filters, search, and export

"use client";

import { useState, useEffect, useMemo } from "react";

interface HistoryJob {
  id: string | number;
  ref: string;
  pickup_time: string;
  from: string;
  to: string;
  fare: number;
  status?: string;
  passenger?: string;
  driver?: string;
}

interface HistoryResponse {
  success: boolean;
  accountId: string;
  from: string;
  to: string;
  totalJobs: number;
  totalFare: number;
  currency: string;
  jobs: HistoryJob[];
  error?: string;
}

type StatusFilter = "all" | "completed" | "cancelled" | "in_progress";
type SortField = "date" | "fare" | "passenger" | "from" | "to";
type SortOrder = "asc" | "desc";

export default function CorporateHistoryPage() {
  // Data state
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Sort state
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Export loading state
  const [isExporting, setIsExporting] = useState(false);

  // Fetch history data
  useEffect(() => {
    async function fetchHistory() {
      setIsLoading(true);
      setError(null);

      try {
        // Get company's TaxiCaller account ID from session
        const sessionRes = await fetch("/api/corporate/auth/session");
        const session = await sessionRes.json();

        if (!session.authenticated || !session.company?.taxiCallerAccountId) {
          setError("Not authenticated or no account linked");
          return;
        }

        const accountId = session.company.taxiCallerAccountId;
        const res = await fetch(
          `/api/corporate-history?accountId=${accountId}&from=${dateFrom}&to=${dateTo}`
        );
        const data = await res.json();

        if (!data.success) {
          setError(data.error || "Failed to load history");
          return;
        }

        setHistory(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load history";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [dateFrom, dateTo]);

  // Filter and sort jobs
  const filteredJobs = useMemo(() => {
    if (!history?.jobs) return [];

    let jobs = [...history.jobs];

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      jobs = jobs.filter(
        (job) =>
          job.ref?.toLowerCase().includes(q) ||
          job.from?.toLowerCase().includes(q) ||
          job.to?.toLowerCase().includes(q) ||
          job.passenger?.toLowerCase().includes(q) ||
          String(job.id).includes(q)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      jobs = jobs.filter((job) => job.status === statusFilter);
    }

    // Apply sorting
    jobs.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison =
            new Date(a.pickup_time).getTime() -
            new Date(b.pickup_time).getTime();
          break;
        case "fare":
          comparison = (a.fare || 0) - (b.fare || 0);
          break;
        case "passenger":
          comparison = (a.passenger || "").localeCompare(b.passenger || "");
          break;
        case "from":
          comparison = (a.from || "").localeCompare(b.from || "");
          break;
        case "to":
          comparison = (a.to || "").localeCompare(b.to || "");
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return jobs;
  }, [history, searchQuery, statusFilter, sortField, sortOrder]);

  // Paginated jobs
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredJobs.slice(start, start + itemsPerPage);
  }, [filteredJobs, currentPage]);

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);

  // Calculate totals for filtered results
  const filteredTotals = useMemo(() => {
    return {
      count: filteredJobs.length,
      fare: filteredJobs.reduce((sum, job) => sum + (job.fare || 0), 0),
    };
  }, [filteredJobs]);

  // Handle sort
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }

  // Format date for display
  function formatDate(isoString: string): string {
    if (!isoString) return "-";
    const d = new Date(isoString);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatTime(isoString: string): string {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Export to CSV
  async function exportCSV() {
    if (!filteredJobs.length) return;

    setIsExporting(true);

    try {
      const headers = ["Date", "Time", "Reference", "Pickup", "Dropoff", "Fare", "Status"];
      const rows = filteredJobs.map((job) => [
        formatDate(job.pickup_time),
        formatTime(job.pickup_time),
        job.ref || job.id,
        job.from,
        job.to,
        `£${(job.fare || 0).toFixed(2)}`,
        job.status || "completed",
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map((v) => `"${v ?? ""}"`).join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `booking-history-${dateFrom}-to-${dateTo}.csv`;
      a.click();

      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  // Export to PDF
  async function exportPDF() {
    if (!filteredJobs.length) return;

    setIsExporting(true);

    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();

      // Header
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text("Classic Cabs - Booking History", 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Period: ${formatDate(dateFrom)} - ${formatDate(dateTo)}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 14, 36);

      // Summary
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text(`Total Bookings: ${filteredTotals.count}`, 14, 46);
      doc.text(`Total Spend: £${filteredTotals.fare.toFixed(2)}`, 14, 52);

      // Table
      const tableData = filteredJobs.map((job) => [
        formatDate(job.pickup_time),
        formatTime(job.pickup_time),
        job.ref || String(job.id),
        job.from?.substring(0, 30) || "-",
        job.to?.substring(0, 30) || "-",
        `£${(job.fare || 0).toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: 60,
        head: [["Date", "Time", "Ref", "Pickup", "Dropoff", "Fare"]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [255, 213, 92],
          textColor: [0, 0, 0],
          fontStyle: "bold",
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 18 },
          2: { cellWidth: 22 },
          3: { cellWidth: 45 },
          4: { cellWidth: 45 },
          5: { cellWidth: 20, halign: "right" },
        },
      });

      doc.save(`booking-history-${dateFrom}-to-${dateTo}.pdf`);
    } finally {
      setIsExporting(false);
    }
  }

  // Reset filters
  function resetFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setCurrentPage(1);
  }

  // Render sort indicator
  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 text-[#555]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {sortOrder === "asc" ? <path d="M7 14l5-5 5 5" /> : <path d="M7 10l5 5 5-5" />}
      </svg>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="skeleton h-6 w-40 rounded mb-2" />
            <div className="skeleton h-4 w-48 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-10 w-16 rounded-lg" />
            <div className="skeleton h-10 w-16 rounded-lg" />
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="bg-[#1b1b1b] p-4 rounded-lg border border-[#333]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="skeleton h-3 w-16 rounded mb-2" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
            <div>
              <div className="skeleton h-3 w-12 rounded mb-2" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
            <div>
              <div className="skeleton h-3 w-8 rounded mb-2" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
            <div>
              <div className="skeleton h-3 w-14 rounded mb-2" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-[#1b1b1b] rounded-lg border border-[#333] overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-[#333]">
            <div className="skeleton h-3 w-16 rounded" style={{ flex: 1 }} />
            <div className="skeleton h-3 w-20 rounded" style={{ flex: 1 }} />
            <div className="skeleton h-3 w-14 rounded" style={{ flex: 2 }} />
            <div className="skeleton h-3 w-16 rounded" style={{ flex: 2 }} />
            <div className="skeleton h-3 w-12 rounded" style={{ flex: 1 }} />
            <div className="skeleton h-3 w-14 rounded" style={{ flex: 1 }} />
          </div>

          {/* Table Rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-4 py-3 ${
                i % 2 === 0 ? "bg-[#1b1b1b]" : "bg-[#181818]"
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div style={{ flex: 1 }}>
                <div className="skeleton h-4 w-20 rounded mb-1" />
                <div className="skeleton h-3 w-12 rounded" />
              </div>
              <div className="skeleton h-5 w-16 rounded" style={{ flex: 1 }} />
              <div className="skeleton h-4 w-full rounded" style={{ flex: 2 }} />
              <div className="skeleton h-4 w-full rounded" style={{ flex: 2 }} />
              <div className="skeleton h-4 w-14 rounded ml-auto" style={{ flex: 1 }} />
              <div className="skeleton h-5 w-16 rounded" style={{ flex: 1 }} />
            </div>
          ))}

          {/* Pagination Skeleton */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#333]">
            <div className="skeleton h-3 w-32 rounded" />
            <div className="flex gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-8 w-8 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#f5f5f5]">Booking History</h2>
          <p className="text-sm text-[#888]">
            {filteredTotals.count} bookings · £{filteredTotals.fare.toFixed(2)} total
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={isExporting || !filteredJobs.length}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-[#333] text-[#ccc] hover:border-[#ffd55c]/50 hover:text-[#ffd55c] rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={isExporting || !filteredJobs.length}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-[#333] text-[#ccc] hover:border-[#ffd55c]/50 hover:text-[#ffd55c] rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1b1b1b] p-4 rounded-lg border border-[#333]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="text-[10px] uppercase tracking-wider text-[#666] mb-1 block">Search</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by ref, address, passenger..."
                className="w-full pl-10 pr-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
              />
            </div>
          </div>

          {/* Date From */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#666] mb-1 block">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] focus:outline-none focus:border-[#ffd55c]/50"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#666] mb-1 block">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] focus:outline-none focus:border-[#ffd55c]/50"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#666] mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] focus:outline-none focus:border-[#ffd55c]/50"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>
        </div>

        {/* Active Filters */}
        {(searchQuery || statusFilter !== "all") && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#333]">
            <span className="text-[10px] uppercase text-[#666]">Active filters:</span>
            {searchQuery && (
              <span className="px-2 py-1 text-xs bg-[#ffd55c]/10 text-[#ffd55c] rounded">
                &quot;{searchQuery}&quot;
              </span>
            )}
            {statusFilter !== "all" && (
              <span className="px-2 py-1 text-xs bg-[#ffd55c]/10 text-[#ffd55c] rounded capitalize">
                {statusFilter.replace("_", " ")}
              </span>
            )}
            <button
              onClick={resetFilters}
              className="text-xs text-[#888] hover:text-[#ffd55c] ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#1b1b1b] rounded-lg border border-[#333] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#333]">
                <th className="text-left py-3 px-4">
                  <button
                    onClick={() => handleSort("date")}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#888] hover:text-[#ffd55c] transition"
                  >
                    Date <SortIndicator field="date" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-[#888]">
                  Reference
                </th>
                <th className="text-left py-3 px-4">
                  <button
                    onClick={() => handleSort("from")}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#888] hover:text-[#ffd55c] transition"
                  >
                    Pickup <SortIndicator field="from" />
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button
                    onClick={() => handleSort("to")}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#888] hover:text-[#ffd55c] transition"
                  >
                    Dropoff <SortIndicator field="to" />
                  </button>
                </th>
                <th className="text-right py-3 px-4">
                  <button
                    onClick={() => handleSort("fare")}
                    className="flex items-center gap-1 justify-end text-[10px] uppercase tracking-wider text-[#888] hover:text-[#ffd55c] transition ml-auto"
                  >
                    Fare <SortIndicator field="fare" />
                  </button>
                </th>
                <th className="text-center py-3 px-4 text-[10px] uppercase tracking-wider text-[#888]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-[#333]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <p className="text-[#666]">No bookings found</p>
                      {(searchQuery || statusFilter !== "all") && (
                        <button
                          onClick={resetFilters}
                          className="text-sm text-[#ffd55c] hover:underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((job, index) => (
                  <tr
                    key={job.id}
                    className={`border-b border-[#222] hover:bg-[#222]/50 transition ${
                      index % 2 === 0 ? "bg-[#1b1b1b]" : "bg-[#181818]"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <p className="text-sm text-[#f5f5f5]">{formatDate(job.pickup_time)}</p>
                      <p className="text-[10px] text-[#666]">{formatTime(job.pickup_time)}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono text-[#ffd55c] bg-[#ffd55c]/10 px-2 py-0.5 rounded">
                        {job.ref || job.id}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-[#ccc] truncate max-w-[200px]" title={job.from}>
                        {job.from || "-"}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-[#ccc] truncate max-w-[200px]" title={job.to}>
                        {job.to || "-"}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-medium text-[#f5f5f5]">
                        £{(job.fare || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[10px] uppercase rounded ${
                          job.status === "completed"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : job.status === "cancelled"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {job.status || "completed"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#333]">
            <p className="text-xs text-[#666]">
              Showing {(currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, filteredJobs.length)} of{" "}
              {filteredJobs.length}
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 text-[#888] hover:text-[#ffd55c] disabled:opacity-30 disabled:cursor-not-allowed"
                title="First page"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="11 17 6 12 11 7" />
                  <polyline points="18 17 13 12 18 7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 text-[#888] hover:text-[#ffd55c] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <span className="px-3 text-sm text-[#ccc]">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 text-[#888] hover:text-[#ffd55c] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next page"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 text-[#888] hover:text-[#ffd55c] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Last page"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="13 17 18 12 13 7" />
                  <polyline points="6 17 11 12 6 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
