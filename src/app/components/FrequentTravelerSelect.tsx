// Frequent Traveler Select & Manage Component
// FEATURE_VERSION: 1.0

"use client";

import { useState, useEffect, useRef } from "react";
import {
  getFrequentTravelers,
  addFrequentTraveler,
  updateFrequentTraveler,
  deleteFrequentTraveler,
  searchFrequentTravelers,
  FrequentTraveler,
} from "@/lib/frequentTravelers";

interface FrequentTravelerSelectProps {
  onSelect: (traveler: FrequentTraveler) => void;
  selectedId?: string;
}

export default function FrequentTravelerSelect({ onSelect, selectedId }: FrequentTravelerSelectProps) {
  // Initialize travelers from localStorage immediately
  const [travelers, setTravelers] = useState<FrequentTraveler[]>(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      return getFrequentTravelers();
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showManage, setShowManage] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    department: "",
    notes: "",
  });

  // Filter travelers based on search
  const filteredTravelers = searchQuery
    ? searchFrequentTravelers(searchQuery)
    : travelers;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleAddTraveler() {
    if (!formData.firstName || !formData.lastName || !formData.phone) return;

    if (editingId) {
      updateFrequentTraveler(editingId, formData);
    } else {
      addFrequentTraveler(formData);
    }

    setTravelers(getFrequentTravelers());
    resetForm();
  }

  function handleDeleteTraveler(id: string) {
    if (confirm("Remove this traveler from your list?")) {
      deleteFrequentTraveler(id);
      setTravelers(getFrequentTravelers());
    }
  }

  function handleEditTraveler(traveler: FrequentTraveler) {
    setFormData({
      firstName: traveler.firstName,
      lastName: traveler.lastName,
      phone: traveler.phone,
      email: traveler.email || "",
      department: traveler.department || "",
      notes: traveler.notes || "",
    });
    setEditingId(traveler.id);
    setShowAddForm(true);
  }

  function resetForm() {
    setFormData({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      department: "",
      notes: "",
    });
    setEditingId(null);
    setShowAddForm(false);
  }

  function handleSelectTraveler(traveler: FrequentTraveler) {
    onSelect(traveler);
    setIsOpen(false);
    setSearchQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 px-3 py-2 text-sm text-left bg-[#111] border border-[#333] rounded-lg text-[#ccc] hover:border-[#ffd55c]/50 transition flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Select Frequent Traveler
          </span>
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        
        <button
          type="button"
          onClick={() => {
            setShowManage(!showManage);
            setIsOpen(false);
          }}
          className="p-2 text-[#888] hover:text-[#ffd55c] border border-[#333] rounded-lg hover:border-[#ffd55c]/50 transition"
          title="Manage Travelers"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-[#333]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search travelers..."
              className="w-full px-3 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
              autoFocus
            />
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredTravelers.length === 0 ? (
              <div className="p-4 text-center text-sm text-[#666]">
                {travelers.length === 0 ? (
                  <>
                    No frequent travelers yet.
                    <button
                      type="button"
                      onClick={() => {
                        setShowManage(true);
                        setShowAddForm(true);
                        setIsOpen(false);
                      }}
                      className="block mx-auto mt-2 text-[#ffd55c] hover:underline"
                    >
                      + Add your first traveler
                    </button>
                  </>
                ) : (
                  "No matching travelers found"
                )}
              </div>
            ) : (
              filteredTravelers.map((traveler) => (
                <button
                  key={traveler.id}
                  type="button"
                  onClick={() => handleSelectTraveler(traveler)}
                  className={`w-full px-3 py-2 text-left hover:bg-[#252525] transition border-b border-[#222] last:border-b-0 ${
                    selectedId === traveler.id ? "bg-[#ffd55c]/10" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#f5f5f5]">
                        {traveler.firstName} {traveler.lastName}
                      </p>
                      <p className="text-[10px] text-[#666]">
                        {traveler.phone}
                        {traveler.department && ` • ${traveler.department}`}
                      </p>
                      {/* Show saved addresses */}
                      {(traveler.homeAddress?.address || traveler.workAddress?.address) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {traveler.homeAddress?.address && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] bg-[#222] text-[#888] rounded">
                              <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                              </svg>
                              Home
                            </span>
                          )}
                          {traveler.workAddress?.address && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] bg-[#222] text-[#888] rounded">
                              <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="7" width="20" height="14" rx="2" />
                              </svg>
                              Work
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedId === traveler.id && (
                      <svg className="w-4 h-4 text-[#ffd55c] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Add New Button */}
          <button
            type="button"
            onClick={() => {
              setShowManage(true);
              setShowAddForm(true);
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-sm text-[#ffd55c] bg-[#ffd55c]/5 hover:bg-[#ffd55c]/10 transition flex items-center justify-center gap-2 border-t border-[#333]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Add New Traveler
          </button>
        </div>
      )}

      {/* Manage Panel */}
      {showManage && (
        <div className="mt-3 p-3 bg-[#151515] border border-[#333] rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#f5f5f5]">
              {showAddForm ? (editingId ? "Edit Traveler" : "Add New Traveler") : "Manage Frequent Travelers"}
            </h3>
            <button
              type="button"
              onClick={() => {
                if (showAddForm) {
                  resetForm();
                } else {
                  setShowManage(false);
                }
              }}
              className="text-[#888] hover:text-[#f5f5f5]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {showAddForm ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#888] mb-1 block">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#f5f5f5] focus:outline-none focus:border-[#ffd55c]/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#888] mb-1 block">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#f5f5f5] focus:outline-none focus:border-[#ffd55c]/50"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#888] mb-1 block">Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+447..."
                    className="w-full px-2 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#888] mb-1 block">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#f5f5f5] focus:outline-none focus:border-[#ffd55c]/50"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-[10px] text-[#888] mb-1 block">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g. Sales, Engineering"
                  className="w-full px-2 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-[#888] mb-1 block">Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any preferences or notes..."
                  className="w-full px-2 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-1.5 text-sm text-[#888] border border-[#333] rounded hover:bg-[#222] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddTraveler}
                  disabled={!formData.firstName || !formData.lastName || !formData.phone}
                  className="flex-1 py-1.5 text-sm bg-[#ffd55c] text-black font-medium rounded hover:bg-[#ffcc33] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingId ? "Save Changes" : "Add Traveler"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {travelers.length === 0 ? (
                <p className="text-sm text-[#666] text-center py-4">
                  No frequent travelers saved yet
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {travelers.map((traveler) => (
                    <div
                      key={traveler.id}
                      className="flex items-center justify-between p-2 bg-[#111] border border-[#222] rounded"
                    >
                      <div>
                        <p className="text-sm text-[#f5f5f5]">
                          {traveler.firstName} {traveler.lastName}
                        </p>
                        <p className="text-[10px] text-[#666]">
                          {traveler.phone}
                          {traveler.department && ` • ${traveler.department}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditTraveler(traveler)}
                          className="p-1 text-[#888] hover:text-[#ffd55c] transition"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTraveler(traveler.id)}
                          className="p-1 text-[#888] hover:text-red-400 transition"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full py-1.5 text-sm text-[#ffd55c] border border-[#ffd55c]/30 rounded hover:bg-[#ffd55c]/10 transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                Add New Traveler
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

