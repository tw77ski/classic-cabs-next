'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Account = {
    id: number;
    name: string;      // TaxiCaller account number / code
    code?: string;     // any extra reference
    cname?: string;    // company name if present
};

type HistoryJob = {
    id: number | string;
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
    totalJobs: number;
    totalFare: number;
    currency: string;
    jobs: HistoryJob[];
};

// -------------- Helpers --------------

function formatDateTime(dt: string | undefined) {
    if (!dt) return '';
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// -------------- Main page --------------

export default function CorporateBookingPage() {
    // --- form state ---
    const [companyName, setCompanyName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');

    const [pickupLocation, setPickupLocation] = useState('');
    const [dropoffLocation, setDropoffLocation] = useState('');
    const [pickupDate, setPickupDate] = useState(''); // yyyy-mm-dd
    const [pickupTime, setPickupTime] = useState(''); // HH:mm
    const [notes, setNotes] = useState('');

    // --- accounts ---
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [accountsError, setAccountsError] = useState<string | null>(null);

    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    // --- submit / server state ---
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // --- history dashboard ---
    const [history, setHistory] = useState<HistoryResponse | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);

    // ---------- Load TaxiCaller accounts once ----------

    useEffect(() => {
        const loadAccounts = async () => {
            try {
                setAccountsLoading(true);
                setAccountsError(null);
                const res = await fetch('/api/corporate-accounts');
                const json = await res.json().catch(() => null);

                if (!res.ok || !json?.success) {
                    throw new Error(json?.error || `HTTP ${res.status}`);
                }

                setAccounts(json.accounts || []);
            } catch (err: unknown) {
                console.error('Failed to load accounts', err);
                setAccountsError(
                    err instanceof Error ? err.message : 'Could not load TaxiCaller accounts.'
                );
            } finally {
                setAccountsLoading(false);
            }
        };

        loadAccounts();
    }, []);

    // ---------- Filtered suggestions from Company Name ----------

    const filteredSuggestions = useMemo(() => {
        const q = companyName.trim().toLowerCase();
        if (!q) return [];
        return accounts.filter((acc) => {
            const label = `${acc.cname || ''} ${acc.name || ''} ${acc.code || ''}`.toLowerCase();
            return label.includes(q);
        });
    }, [companyName, accounts]);

    const handlePickSuggestion = (acc: Account) => {
        const label = acc.cname || acc.name || `Account ${acc.id}`;
        setCompanyName(label.trim());
        setSelectedAccountId(String(acc.id));
        setShowSuggestions(false);
    };

    // ---------- Booking submit ----------

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError(null);
        setSuccessMessage(null);

        if (!firstName || !lastName || !phone || !pickupLocation || !dropoffLocation) {
            setServerError(
                'Please fill in at least name, mobile number, pickup and drop-off.'
            );
            return;
        }

        // Build ISO date/time; if either missing -> ASAP
        let pickupIso: string | null = null;
        if (pickupDate && pickupTime) {
            const composed = new Date(`${pickupDate}T${pickupTime}:00`);
            if (!Number.isNaN(composed.getTime())) {
                pickupIso = composed.toISOString();
            }
        }

        const payload = {
            companyName: companyName.trim(),
            contactPerson: contactPerson.trim(),
            poNumber: poNumber.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            email: email.trim(),
            pickupAddress: pickupLocation.trim(),
            dropoffAddress: dropoffLocation.trim(),
            time: pickupIso, // null/undefined means ASAP to the API
            notes: notes.trim(),
            accountId: selectedAccountId || undefined,
        };

        try {
            setSubmitting(true);

            const res = await fetch('/api/corporate-book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const json = await res.json().catch(() => null);

            if (!res.ok || !json?.success) {
                console.error('Corporate booking error response', {
                    status: res.status,
                    body: json,
                });
                const msg =
                json?.error ||
                (json && typeof json === 'object'
                ? JSON.stringify(json)
                : `Booking failed (HTTP ${res.status})`);
                setServerError(msg);
                return;
            }

            setSuccessMessage('Corporate booking created successfully.');
            // Optionally clear some fields but keep account / company
            setContactPerson('');
            setPoNumber('');
            setFirstName('');
            setLastName('');
            setPhone('');
            setEmail('');
            setPickupLocation('');
            setDropoffLocation('');
            setPickupDate('');
            setPickupTime('');
            setNotes('');

            // Refresh dashboard for this account (if any)
            if (selectedAccountId) {
                fetchHistory(selectedAccountId);
            }
        } catch (err: unknown) {
            console.error('Corporate booking submit error', err);
            const errorMessage = err instanceof Error ? err.message : 'Something went wrong while booking.';
            setServerError(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    // ---------- History fetching ----------

    const fetchHistory = async (accountId?: string) => {
        try {
            setHistoryLoading(true);
            setHistoryError(null);

            const params = new URLSearchParams();
            if (accountId) params.set('accountId', accountId);

            const res = await fetch(`/api/corporate-history?${params.toString()}`);
            const json = (await res.json().catch(() => null)) as HistoryResponse | null;

            if (!res.ok || !json?.success) {
                const errorResponse = json as { error?: string } | null;
                throw new Error(errorResponse?.error || `HTTP ${res.status}`);
            }

            setHistory(json);
        } catch (err: unknown) {
            console.error('Error loading corporate history', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to load account history.';
            setHistoryError(errorMessage);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Load default history on first render (no specific account)
    useEffect(() => {
        fetchHistory();
    }, []);

    // ---------- Render ----------

    return (
        <main className="min-h-screen bg-gradient-to-b from-[#080120] via-[#0f0b1b] to-[#1f1b2f] text-slate-100">
        <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-[0.15em] text-amber-300">
        CORPORATE BOOKING
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
        Book rides for account clients and have them billed to their TaxiCaller
        customer account. This page is intended for internal use by Classic Cab Co.
        </p>
        </header>

        {/* FORM CARD */}
        <section className="rounded-3xl border border-slate-800 bg-black/40 p-6 shadow-xl shadow-black/40 backdrop-blur">
        <h2 className="mb-4 text-xs font-semibold tracking-[0.22em] text-amber-200">
        ACCOUNT JOURNEY DETAILS
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
        {/* Company + contact */}
        <div className="grid gap-4 md:grid-cols-2">
        <div className="relative">
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        COMPANY NAME *
        </label>
        <input
        type="text"
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none ring-amber-400/0 transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        placeholder="Start typing to search TaxiCaller accounts…"
        value={companyName}
        onChange={(e) => {
            setCompanyName(e.target.value);
            setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
            // small delay so click can register
            setTimeout(() => setShowSuggestions(false), 150);
        }}
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900/95 text-xs shadow-lg">
            {filteredSuggestions.map((acc) => (
                <button
                key={acc.id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-800"
                onClick={() => handlePickSuggestion(acc)}
                >
                <span>{acc.cname || 'Unnamed account'}</span>
                <span className="ml-2 text-[11px] text-slate-400">
                {acc.name} • ID: {acc.id}
                </span>
                </button>
            ))}
            </div>
        )}
        {accountsLoading && (
            <p className="mt-1 text-[11px] text-slate-400">
            Loading TaxiCaller accounts…
            </p>
        )}
        {accountsError && (
            <p className="mt-1 text-[11px] text-rose-400">{accountsError}</p>
        )}
        </div>

        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        CONTACT PERSON *
        </label>
        <input
        type="text"
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        value={contactPerson}
        onChange={(e) => setContactPerson(e.target.value)}
        placeholder="Who requested the booking"
        />
        </div>
        </div>

        {/* TaxiCaller account select + PO */}
        <div className="grid gap-4 md:grid-cols-2">
        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        TAXICALLER ACCOUNT
        </label>
        <select
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        value={selectedAccountId}
        onChange={(e) => setSelectedAccountId(e.target.value)}
        >
        <option value="">Select account (or leave empty to use API default)</option>
        {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
            {(acc.cname || 'Account') +
                ' – ' +
                (acc.name || '') +
                ' • ID: ' +
        acc.id}
        </option>
        ))}
        </select>
        </div>

        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        PO NUMBER (OPTIONAL)
        </label>
        <input
        type="text"
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        value={poNumber}
        onChange={(e) => setPoNumber(e.target.value)}
        placeholder="Purchase order / internal reference"
        />
        </div>
        </div>

        {/* Passenger */}
        <div className="grid gap-4 md:grid-cols-3">
        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        FIRST NAME *
        </label>
        <input
        type="text"
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        />
        </div>
        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        LAST NAME *
        </label>
        <input
        type="text"
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        />
        </div>
        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        MOBILE NUMBER *
        </label>
        <input
        type="tel"
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        placeholder="+44…"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        />
        </div>
        </div>

        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        EMAIL (OPTIONAL)
        </label>
        <input
        type="email"
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="For confirmations / receipts"
        />
        </div>

        {/* Locations */}
        <div className="grid gap-4 md:grid-cols-2">
        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        PICKUP LOCATION *
        </label>
        <input
        type="text"
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        value={pickupLocation}
        onChange={(e) => setPickupLocation(e.target.value)}
        placeholder="Address or landmark"
        />
        </div>
        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        DROP-OFF LOCATION *
        </label>
        <input
        type="text"
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        value={dropoffLocation}
        onChange={(e) => setDropoffLocation(e.target.value)}
        placeholder="Address or landmark"
        />
        </div>
        </div>

        {/* Date / time */}
        <div className="grid gap-4 md:grid-cols-2">
        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        PICKUP DATE
        </label>
        <input
        type="date"
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        value={pickupDate}
        onChange={(e) => setPickupDate(e.target.value)}
        />
        </div>
        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        PICKUP TIME
        </label>
        <input
        type="time"
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        value={pickupTime}
        onChange={(e) => setPickupTime(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-slate-400">
        Leave both date and time empty for ASAP.
        </p>
        </div>
        </div>

        {/* Notes */}
        <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-slate-300">
        NOTES FOR DRIVER / INVOICING (OPTIONAL)
        </label>
        <textarea
        className="min-h-[80px] w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Flight number, luggage, invoicing notes, etc."
        />
        </div>

        {/* Messages */}
        {serverError && (
            <p className="text-sm text-rose-400">{serverError}</p>
        )}
        {successMessage && (
            <p className="text-sm text-emerald-400">{successMessage}</p>
        )}

        {/* Submit */}
        <div className="pt-2">
        <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-slate-900 shadow-lg shadow-amber-500/40 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
        {submitting ? 'BOOKING…' : 'BOOK TO ACCOUNT'}
        </button>
        </div>
        </form>
        </section>

        {/* DASHBOARD */}
        <section className="mt-10 rounded-3xl border border-slate-800 bg-black/40 p-6 shadow-xl shadow-black/40 backdrop-blur">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <h2 className="text-xs font-semibold tracking-[0.22em] text-amber-200">
        ACCOUNT OVERVIEW
        </h2>
        <div className="text-[11px] text-slate-400">
        Showing completed jobs from the 1st of this month until today.
        </div>
        </div>

        {historyLoading && (
            <p className="text-sm text-slate-300">Loading account history…</p>
        )}
        {historyError && (
            <p className="text-sm text-rose-400">{historyError}</p>
        )}
        {history && !historyLoading && !historyError && (
            <>
            <p className="mb-4 text-sm text-slate-200">
            Period:{' '}
            <span className="font-mono text-slate-100">
            {formatDateTime(history.from)} – {formatDateTime(history.to)}
            </span>
            <br />
            Jobs:{' '}
            <span className="font-semibold">{history.totalJobs}</span> •
            Total fare:{' '}
            <span className="font-semibold">
            {history.currency} {history.totalFare.toFixed(2)}
            </span>
            </p>

            {history.jobs.length === 0 ? (
                <p className="text-sm text-slate-400">
                No jobs found for this period.
                </p>
            ) : (
                <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs text-slate-200">
                <thead className="border-b border-slate-700 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                <th className="py-2 pr-4">Job</th>
                <th className="py-2 pr-4">Pickup time</th>
                <th className="py-2 pr-4">From</th>
                <th className="py-2 pr-4">To</th>
                <th className="py-2 pr-4 text-right">Fare</th>
                </tr>
                </thead>
                <tbody>
                {history.jobs.map((job) => (
                    <tr
                    key={job.id}
                    className="border-b border-slate-800/60 last:border-0"
                    >
                    <td className="py-2 pr-4 font-mono text-[11px] text-slate-300">
                    {job.ref || job.id}
                    </td>
                    <td className="py-2 pr-4">
                    {formatDateTime(job.pickup_time)}
                    </td>
                    <td className="py-2 pr-4">{job.from}</td>
                    <td className="py-2 pr-4">{job.to}</td>
                    <td className="py-2 pr-4 text-right">
                    {job.fare != null
                        ? `${history.currency} ${job.fare.toFixed(2)}`
                        : '-'}
                        </td>
                        </tr>
                ))}
                </tbody>
                </table>
                </div>
            )}
            </>
        )}
        </section>
        </div>
        </main>
    );
}
