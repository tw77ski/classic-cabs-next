"use client";

interface TimingFormProps {
  asap: boolean;
  setAsap: (val: boolean) => void;
  pickupTimeUnix: number | null;
  setPickupTimeUnix: (val: number | null) => void;
  returnTrip: boolean;
  setReturnTrip: (val: boolean) => void;
  returnTimeUnix: number | null;
  setReturnTimeUnix: (val: number | null) => void;
}

export default function TimingForm({
  asap,
  setAsap,
  pickupTimeUnix: _pickupTimeUnix,
  setPickupTimeUnix,
  returnTrip,
  setReturnTrip,
  returnTimeUnix: _returnTimeUnix,
  setReturnTimeUnix,
}: TimingFormProps) {
  // Suppress unused variable warnings - these are controlled by parent
  void _pickupTimeUnix;
  void _returnTimeUnix;
  return (
    <div className="form-card">
      <h2 className="section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        When do you need a ride?
      </h2>

      {/* Timing Options */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          type="button"
          onClick={() => setAsap(false)}
          className={`p-3 flex flex-col items-center gap-1.5 ${
            !asap 
              ? 'glow-card-selected border-[#c9a962] bg-[#c9a962]/10' 
              : 'glow-card border border-[#283632] hover:border-[#c9a962]/50'
          }`}
        >
          <svg 
            className={`w-5 h-5 ${!asap ? 'text-[#c9a962]' : 'text-[#9ba39b]'}`} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span 
            className={`text-xs font-medium ${!asap ? 'text-[#c9a962]' : 'text-[#9ba39b]'}`}
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Schedule
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAsap(true)}
          className={`p-3 flex flex-col items-center gap-1.5 ${
            asap 
              ? 'glow-card-selected border-[#c9a962] bg-[#c9a962]/10' 
              : 'glow-card border border-[#283632] hover:border-[#c9a962]/50'
          }`}
        >
          <svg 
            className={`w-5 h-5 ${asap ? 'text-[#c9a962]' : 'text-[#9ba39b]'}`} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span 
            className={`text-xs font-medium ${asap ? 'text-[#c9a962]' : 'text-[#9ba39b]'}`}
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Right Now
          </span>
        </button>
      </div>

      {/* Datetime Picker for Scheduled */}
      {!asap && (
        <div className="mb-4 animate-fade-up">
          <label 
            className="block text-[#c9a962]/90 text-xs font-medium mb-1.5 tracking-wide"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Pickup Date & Time
          </label>
          <div className="input-with-icon">
            <span className="input-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </span>
        <input
          type="datetime-local"
              className="form-input"
          onChange={(e) =>
            setPickupTimeUnix(Math.floor(new Date(e.target.value).getTime() / 1000))
          }
        />
          </div>
        </div>
      )}

      <div className="gold-divider" />

      {/* Return Trip Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#c9a962]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 2l4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="M7 22l-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
          <div>
            <span 
              className="text-[#f7f1e4] text-sm font-medium"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              Return Trip
            </span>
            <p 
              className="text-[#9ba39b] text-xs"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              Book a ride back
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReturnTrip(!returnTrip)}
          className={`toggle-switch ${returnTrip ? 'active' : ''}`}
          aria-label="Toggle return trip"
        />
      </div>

      {/* Return Trip Datetime */}
      {returnTrip && (
        <div className="mt-4 animate-fade-up">
          <label 
            className="block text-[#c9a962]/90 text-xs font-medium mb-1.5 tracking-wide"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Return Date & Time
          </label>
          <div className="input-with-icon">
            <span className="input-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </span>
        <input
          type="datetime-local"
              className="form-input"
          onChange={(e) =>
            setReturnTimeUnix(Math.floor(new Date(e.target.value).getTime() / 1000))
          }
        />
          </div>
        </div>
      )}
    </div>
  );
}
