// Corporate Passengers Management Page
// /corporate/passengers
// Manage frequent travelers for quick booking

"use client";

import { useState, useEffect, useMemo } from "react";

interface PassengerAddress {
  label: string;
  address: string;
  lat?: number;
  lng?: number;
}

interface Passenger {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  department?: string;
  notes?: string;
  homeAddress?: PassengerAddress;
  workAddress?: PassengerAddress;
  otherAddresses?: PassengerAddress[];
  createdAt: string;
  lastUsed?: string;
  bookingCount: number;
}

type SortField = "name" | "department" | "bookings" | "lastUsed";
type SortOrder = "asc" | "desc";

export default function CorporatePassengersPage() {
  // Passenger list
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  // Sort
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    department: "",
    notes: "",
    homeAddress: "",
    workAddress: "",
  });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load passengers from localStorage (in production, this would be an API call)
  useEffect(() => {
    async function loadPassengers() {
      setIsLoading(true);
      
      try {
        // Check if we have passengers in localStorage
        const stored = localStorage.getItem("corporate_passengers");
        
        if (stored) {
          setPassengers(JSON.parse(stored));
        } else {
          // Demo data for first-time users
          const demoPassengers: Passenger[] = [
            {
              id: "1",
              firstName: "John",
              lastName: "Smith",
              phone: "+447700123456",
              email: "john.smith@company.com",
              department: "Sales",
              notes: "Prefers window seat",
              createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              bookingCount: 12,
            },
            {
              id: "2",
              firstName: "Sarah",
              lastName: "Jones",
              phone: "+447700234567",
              email: "sarah.jones@company.com",
              department: "Marketing",
              createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              bookingCount: 8,
            },
            {
              id: "3",
              firstName: "Mike",
              lastName: "Brown",
              phone: "+447700345678",
              email: "mike.brown@company.com",
              department: "Engineering",
              notes: "Usually travels to airport",
              createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
              lastUsed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              bookingCount: 24,
            },
            {
              id: "4",
              firstName: "Emma",
              lastName: "Wilson",
              phone: "+447700456789",
              department: "HR",
              createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
              bookingCount: 3,
            },
          ];
          setPassengers(demoPassengers);
          localStorage.setItem("corporate_passengers", JSON.stringify(demoPassengers));
        }
      } catch (error) {
        console.error("Failed to load passengers:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPassengers();
  }, []);

  // Save passengers to localStorage
  function savePassengers(updated: Passenger[]) {
    setPassengers(updated);
    localStorage.setItem("corporate_passengers", JSON.stringify(updated));
  }

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = new Set(passengers.map((p) => p.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [passengers]);

  // Filter and sort passengers
  const filteredPassengers = useMemo(() => {
    let result = [...passengers];

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.email?.toLowerCase().includes(q) ||
          p.department?.toLowerCase().includes(q)
      );
    }

    // Apply department filter
    if (departmentFilter !== "all") {
      result = result.filter((p) => p.department === departmentFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`
          );
          break;
        case "department":
          comparison = (a.department || "").localeCompare(b.department || "");
          break;
        case "bookings":
          comparison = a.bookingCount - b.bookingCount;
          break;
        case "lastUsed":
          const aDate = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
          const bDate = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
          comparison = aDate - bDate;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [passengers, searchQuery, departmentFilter, sortField, sortOrder]);

  // Handle sort
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  // Open add/edit modal
  function openModal(passenger?: Passenger) {
    if (passenger) {
      setEditingPassenger(passenger);
      setFormData({
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        phone: passenger.phone,
        email: passenger.email || "",
        department: passenger.department || "",
        notes: passenger.notes || "",
        homeAddress: passenger.homeAddress?.address || "",
        workAddress: passenger.workAddress?.address || "",
      });
    } else {
      setEditingPassenger(null);
      setFormData({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        department: "",
        notes: "",
        homeAddress: "",
        workAddress: "",
      });
    }
    setSaveError(null);
    setShowModal(true);
  }

  // Close modal
  function closeModal() {
    setShowModal(false);
    setEditingPassenger(null);
    setSaveError(null);
  }

  // Validate form
  function validateForm(): string | null {
    if (!formData.firstName.trim()) return "First name is required";
    if (!formData.lastName.trim()) return "Last name is required";
    if (!formData.phone.trim()) return "Phone number is required";
    
    // Basic phone validation
    const phoneRegex = /^\+?[1-9]\d{6,15}$/;
    const cleanPhone = formData.phone.replace(/\s/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      return "Please enter a valid phone number";
    }

    // Email validation (if provided)
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        return "Please enter a valid email address";
      }
    }

    return null;
  }

  // Save passenger
  async function handleSave() {
    const error = validateForm();
    if (error) {
      setSaveError(error);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Build passenger data with address objects
      const passengerData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        email: formData.email,
        department: formData.department,
        notes: formData.notes,
        homeAddress: formData.homeAddress ? {
          label: "Home",
          address: formData.homeAddress,
        } : undefined,
        workAddress: formData.workAddress ? {
          label: "Work",
          address: formData.workAddress,
        } : undefined,
      };

      if (editingPassenger) {
        // Update existing passenger
        const updated = passengers.map((p) =>
          p.id === editingPassenger.id
            ? {
                ...p,
                ...passengerData,
              }
            : p
        );
        savePassengers(updated);
      } else {
        // Add new passenger
        const newPassenger: Passenger = {
          id: Date.now().toString(),
          ...passengerData,
          createdAt: new Date().toISOString(),
          bookingCount: 0,
        };
        savePassengers([...passengers, newPassenger]);
      }

      closeModal();
    } catch (err: any) {
      setSaveError(err.message || "Failed to save passenger");
    } finally {
      setIsSaving(false);
    }
  }

  // Delete passenger
  async function handleDelete(id: string) {
    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      const updated = passengers.filter((p) => p.id !== id);
      savePassengers(updated);
      setDeletingId(null);
    } catch (err) {
      console.error("Failed to delete passenger:", err);
    }
  }

  // Format date for display
  function formatDate(isoString?: string): string {
    if (!isoString) return "Never";
    const d = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  }

  // Sort indicator component
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
            <div className="skeleton h-4 w-28 rounded" />
          </div>
          <div className="skeleton h-10 w-36 rounded-lg" />
        </div>

        {/* Filters Skeleton */}
        <div className="bg-[#1b1b1b] p-4 rounded-lg border border-[#333]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="skeleton h-3 w-16 rounded mb-2" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
            <div>
              <div className="skeleton h-3 w-20 rounded mb-2" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>

        {/* Passenger Cards Skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#1b1b1b] rounded-lg border border-[#333] p-4"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className="skeleton w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-32 rounded" />
                  <div className="skeleton h-3 w-20 rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="skeleton h-8 w-8 rounded" />
                  <div className="skeleton h-8 w-8 rounded" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-3 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#f5f5f5]">Frequent Travelers</h2>
          <p className="text-sm text-[#888]">
            {passengers.length} passengers saved
          </p>
        </div>

        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[#ffd55c] text-black text-sm font-medium rounded-lg hover:bg-[#ffcc33] transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          Add Passenger
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#1b1b1b] p-4 rounded-lg border border-[#333]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, email, department..."
                className="w-full pl-10 pr-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
              />
            </div>
          </div>

          {/* Department Filter */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#666] mb-1 block">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] focus:outline-none focus:border-[#ffd55c]/50"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Passengers Grid */}
      {filteredPassengers.length === 0 ? (
        <div className="bg-[#1b1b1b] rounded-lg border border-[#333] p-12">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#222] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#444]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="text-[#888] mb-2">
              {searchQuery || departmentFilter !== "all"
                ? "No passengers match your filters"
                : "No passengers saved yet"}
            </p>
            {!searchQuery && departmentFilter === "all" && (
              <button
                onClick={() => openModal()}
                className="text-sm text-[#ffd55c] hover:underline"
              >
                Add your first passenger
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Table Header (desktop) */}
          <div className="hidden lg:block bg-[#1b1b1b] rounded-t-lg border border-[#333] border-b-0">
            <div className="grid grid-cols-12 gap-4 px-4 py-3">
              <div className="col-span-4">
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#888] hover:text-[#ffd55c] transition"
                >
                  Name <SortIndicator field="name" />
                </button>
              </div>
              <div className="col-span-2">
                <button
                  onClick={() => handleSort("department")}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#888] hover:text-[#ffd55c] transition"
                >
                  Department <SortIndicator field="department" />
                </button>
              </div>
              <div className="col-span-2 text-[10px] uppercase tracking-wider text-[#888]">
                Contact
              </div>
              <div className="col-span-1 text-center">
                <button
                  onClick={() => handleSort("bookings")}
                  className="flex items-center gap-1 justify-center text-[10px] uppercase tracking-wider text-[#888] hover:text-[#ffd55c] transition"
                >
                  Trips <SortIndicator field="bookings" />
                </button>
              </div>
              <div className="col-span-2">
                <button
                  onClick={() => handleSort("lastUsed")}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#888] hover:text-[#ffd55c] transition"
                >
                  Last Used <SortIndicator field="lastUsed" />
                </button>
              </div>
              <div className="col-span-1 text-right text-[10px] uppercase tracking-wider text-[#888]">
                Actions
              </div>
            </div>
          </div>

          {/* Passenger Cards/Rows */}
          <div className="space-y-2 lg:space-y-0 lg:bg-[#1b1b1b] lg:rounded-b-lg lg:border lg:border-[#333] lg:border-t-0">
            {filteredPassengers.map((passenger, index) => (
              <div
                key={passenger.id}
                className={`bg-[#1b1b1b] rounded-lg border border-[#333] p-4 lg:rounded-none lg:border-0 lg:border-b lg:last:border-b-0 lg:px-4 lg:py-3 hover:bg-[#222]/50 transition ${
                  index % 2 === 0 ? "lg:bg-[#1b1b1b]" : "lg:bg-[#181818]"
                }`}
              >
                {/* Mobile Layout */}
                <div className="lg:hidden">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#ffd55c]/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-[#ffd55c]">
                          {passenger.firstName.charAt(0)}
                          {passenger.lastName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#f5f5f5]">
                          {passenger.firstName} {passenger.lastName}
                        </p>
                        {passenger.department && (
                          <p className="text-xs text-[#888]">{passenger.department}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openModal(passenger)}
                        className="p-2 text-[#888] hover:text-[#ffd55c] hover:bg-[#ffd55c]/10 rounded transition"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeletingId(passenger.id)}
                        className="p-2 text-[#888] hover:text-red-400 hover:bg-red-500/10 rounded transition"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                    <div>
                      <span className="text-[#666]">Phone: </span>
                      <span className="text-[#ccc]">{passenger.phone}</span>
                    </div>
                    <div>
                      <span className="text-[#666]">Trips: </span>
                      <span className="text-[#ffd55c]">{passenger.bookingCount}</span>
                    </div>
                    {passenger.email && (
                      <div className="col-span-2">
                        <span className="text-[#666]">Email: </span>
                        <span className="text-[#ccc]">{passenger.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center">
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#ffd55c]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-[#ffd55c]">
                        {passenger.firstName.charAt(0)}
                        {passenger.lastName.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#f5f5f5] truncate">
                        {passenger.firstName} {passenger.lastName}
                      </p>
                      {passenger.notes && (
                        <p className="text-[10px] text-[#666] truncate">{passenger.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    {passenger.department ? (
                      <span className="px-2 py-0.5 text-xs bg-[#222] text-[#aaa] rounded">
                        {passenger.department}
                      </span>
                    ) : (
                      <span className="text-xs text-[#555]">—</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-[#ccc]">{passenger.phone}</p>
                    {passenger.email && (
                      <p className="text-[10px] text-[#666] truncate">{passenger.email}</p>
                    )}
                  </div>
                  <div className="col-span-1 text-center">
                    <span className="text-sm font-medium text-[#ffd55c]">
                      {passenger.bookingCount}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-[#888]">
                      {formatDate(passenger.lastUsed)}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end gap-1">
                    <button
                      onClick={() => openModal(passenger)}
                      className="p-1.5 text-[#888] hover:text-[#ffd55c] hover:bg-[#ffd55c]/10 rounded transition"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeletingId(passenger.id)}
                      className="p-1.5 text-[#888] hover:text-red-400 hover:bg-red-500/10 rounded transition"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1b1b1b] border border-[#333] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#333]">
              <h3 className="text-lg font-semibold text-[#f5f5f5]">
                {editingPassenger ? "Edit Passenger" : "Add New Passenger"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-[#888] hover:text-[#f5f5f5] transition"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {saveError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  {saveError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#888] mb-1 block">
                    First Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888] mb-1 block">
                    Last Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#888] mb-1 block">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                  placeholder="+447700123456"
                />
              </div>

              <div>
                <label className="text-xs text-[#888] mb-1 block">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                  placeholder="john.smith@company.com"
                />
              </div>

              <div>
                <label className="text-xs text-[#888] mb-1 block">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                  placeholder="Sales, Marketing, Engineering..."
                  list="departments"
                />
                <datalist id="departments">
                  {departments.map((dept) => (
                    <option key={dept} value={dept} />
                  ))}
                </datalist>
              </div>

              {/* Addresses Section */}
              <div className="pt-3 border-t border-[#333]">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="text-xs font-medium text-[#888]">Saved Addresses</span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#888] mb-1 block flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      Home Address
                    </label>
                    <input
                      type="text"
                      value={formData.homeAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, homeAddress: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                      placeholder="e.g. 12 High Street, St Helier, JE2 4WE"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-[#888] mb-1 block flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                      Work Address
                    </label>
                    <input
                      type="text"
                      value={formData.workAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, workAddress: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                      placeholder="e.g. Office Park, La Route de St Aubin, JE3 8BP"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#888] mb-1 block">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50 resize-none h-20"
                  placeholder="Preferences, special requirements..."
                  maxLength={200}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-4 border-t border-[#333]">
              <button
                onClick={closeModal}
                className="flex-1 py-2 text-sm border border-[#333] text-[#ccc] hover:border-[#555] rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2 text-sm bg-[#ffd55c] text-black font-medium rounded-lg hover:bg-[#ffcc33] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Passenger"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1b1b1b] border border-[#333] rounded-xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#f5f5f5] mb-2">Delete Passenger?</h3>
              <p className="text-sm text-[#888] mb-6">
                This action cannot be undone. The passenger will be removed from your frequent travelers list.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-2 text-sm border border-[#333] text-[#ccc] hover:border-[#555] rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deletingId)}
                  className="flex-1 py-2 text-sm bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
