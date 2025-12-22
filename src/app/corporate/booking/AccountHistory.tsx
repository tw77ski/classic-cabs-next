"use client";

import React, { useState, useEffect, useCallback } from "react";

/* Types */
type HistoryJob = {
  id: string | number;
  ref?: string;
  pickup_time?: string;
  from?: string;
  to?: string;
  fare?: number;
};

type HistoryResponse = {
  success: boolean;
  from: string;
  to: string;
  totalJobs?: number;
  totalFare?: number;
  currency?: string;
  jobs: HistoryJob[];
};

interface AccountHistoryProps {
  accountId: number;
  companyName: string;
  refreshTrigger?: number;
}

const HISTORY_API = "/api/corporate-history";

/* Helpers */
function formatDateTime(dt?: string) {
  if (!dt) return "";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* CSV Export */
function exportCSV(history: HistoryResponse | null, companyName: string) {
  if (!history) return;

  const headers = ["Ref", "Pickup Time", "From", "To", "Fare"];
  const rows = history.jobs.map((j) => [
    j.ref || j.id,
    j.pickup_time,
    j.from,
    j.to,
    j.fare?.toFixed(2) || "0.00",
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${v ?? ""}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${companyName.replace(/\s+/g, "_")}_bookings.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* PDF Export */
async function exportPDF(history: HistoryResponse | null, companyName: string) {
  if (!history) return;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`${companyName} - Booking History`, 20, 20);
  doc.setFontSize(10);
  doc.text(`Period: ${formatDateTime(history.from)} - ${formatDateTime(history.to)}`, 20, 30);

  if (history.totalJobs !== undefined) {
    doc.text(
      `Total Jobs: ${history.totalJobs} | Total Fare: ${history.currency || "GBP"} ${history.totalFare?.toFixed(2) || "0.00"}`,
      20,
      38
    );
  }

  doc.setFontSize(9);
  let y = 50;
  history.jobs.forEach((j) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(
      `#${j.ref || j.id} | ${formatDateTime(j.pickup_time)} | ${j.from} → ${j.to} | £${j.fare?.toFixed(2) || "0.00"}`,
      20,
      y
    );
    y += 7;
  });

  doc.save(`${companyName.replace(/\s+/g, "_")}_bookings.pdf`);
}

export default function AccountHistory({ accountId, companyName, refreshTrigger }: AccountHistoryProps) {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!accountId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${HISTORY_API}?accountId=${accountId}`);
      const json = await res.json();
      if (json.success) {
        setHistory(json);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, refreshTrigger]);

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] uppercase tracking-widest text-muted">Recent Bookings</h4>
        {history && history.jobs.length > 0 && (
          <div className="flex gap-1">
            <button
              onClick={() => exportCSV(history, companyName)}
              className="px-2 py-0.5 text-[10px] border border-border text-muted hover:text-[#ffd55c] hover:border-[#ffd55c]/50 rounded transition"
            >
              CSV
            </button>
            <button
              onClick={() => exportPDF(history, companyName)}
              className="px-2 py-0.5 text-[10px] border border-border text-muted hover:text-[#ffd55c] hover:border-[#ffd55c]/50 rounded transition"
            >
              PDF
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-[#ffd55c]/30 border-t-[#ffd55c] rounded-full animate-spin" />
        </div>
      ) : !history || history.jobs.length === 0 ? (
        <p className="text-xs text-muted text-center py-4">No recent bookings</p>
      ) : (
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {history.jobs.slice(0, 6).map((job) => (
            <div key={job.id} className="p-2 bg-background rounded-lg border border-border">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-mono text-[#ffd55c]">#{job.ref || job.id}</span>
                <span className="text-[10px] text-muted">{formatDateTime(job.pickup_time)}</span>
              </div>
              <p className="text-xs text-muted truncate">
                {job.from} → {job.to}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

