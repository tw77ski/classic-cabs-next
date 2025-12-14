// Animated Button Component with Ripple Effect
// Beautiful micro-interactions for button presses

"use client";

import { useState, useRef, MouseEvent, ReactNode } from "react";

interface RippleType {
  x: number;
  y: number;
  id: number;
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  icon?: ReactNode;
}

export default function Button({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  type = "button",
  icon,
}: ButtonProps) {
  const [ripples, setRipples] = useState<RippleType[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Create ripple effect on click
  function createRipple(e: MouseEvent<HTMLButtonElement>) {
    if (disabled || loading) return;

    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple: RippleType = {
      x,
      y,
      id: Date.now(),
    };

    setRipples((prev) => [...prev, newRipple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  }

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    createRipple(e);
    if (!disabled && !loading && onClick) {
      onClick();
    }
  }

  // Variant styles
  const variantStyles = {
    primary: `
      bg-gradient-to-b from-[#d4b56e] via-[var(--accent)] to-[var(--accent-dark)]
      text-[var(--text-inverse)] font-semibold
      border-t border-white/30
      shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-2px_4px_rgba(0,0,0,0.2)_inset,0_3px_0_#8a7339,0_5px_8px_var(--shadow-color)]
      hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_-2px_4px_rgba(0,0,0,0.2)_inset,0_5px_0_#8a7339,0_8px_12px_var(--shadow-color)]
      hover:-translate-y-0.5
      active:translate-y-0.5 active:shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_-2px_4px_rgba(0,0,0,0.25)_inset,0_2px_0_#8a7339]
    `,
    secondary: `
      bg-gradient-to-b from-[rgba(201,169,98,0.1)] to-transparent
      text-[var(--accent)] font-medium
      border border-[var(--border-accent)]
      hover:bg-[rgba(201,169,98,0.15)] hover:border-[var(--accent)]
      active:scale-[0.98]
    `,
    outline: `
      bg-transparent
      text-[var(--text-primary)] font-medium
      border border-[var(--border)]
      hover:border-[var(--accent)] hover:text-[var(--accent)]
      active:scale-[0.98]
    `,
    ghost: `
      bg-transparent
      text-[var(--text-secondary)] font-medium
      hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]
      active:scale-[0.98]
    `,
    danger: `
      bg-gradient-to-b from-red-500 to-red-600
      text-white font-semibold
      border-t border-white/20
      shadow-[0_3px_0_#991b1b,0_5px_8px_var(--shadow-color)]
      hover:shadow-[0_5px_0_#991b1b,0_8px_12px_var(--shadow-color)]
      hover:-translate-y-0.5
      active:translate-y-0.5 active:shadow-[0_2px_0_#991b1b]
    `,
  };

  // Size styles
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs rounded-md min-h-[32px]",
    md: "px-4 py-2.5 text-sm rounded-lg min-h-[44px]",
    lg: "px-6 py-3.5 text-base rounded-lg min-h-[52px]",
  };

  // Ripple color based on variant
  const rippleColor =
    variant === "primary" || variant === "danger"
      ? "rgba(255, 255, 255, 0.4)"
      : "var(--accent-glow)";

  return (
    <button
      ref={buttonRef}
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`
        relative overflow-hidden
        inline-flex items-center justify-center gap-2
        font-['DM_Sans',sans-serif] uppercase tracking-wider
        transition-all duration-200 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
    >
      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none animate-[ripple-effect_0.6s_ease-out_forwards]"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 10,
            height: 10,
            marginLeft: -5,
            marginTop: -5,
            background: rippleColor,
          }}
        />
      ))}

      {/* Loading spinner */}
      {loading && (
        <div
          className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{
            borderColor:
              variant === "primary" || variant === "danger"
                ? "rgba(0,0,0,0.2)"
                : "var(--accent-glow)",
            borderTopColor:
              variant === "primary" || variant === "danger"
                ? "currentColor"
                : "var(--accent)",
          }}
        />
      )}

      {/* Icon */}
      {!loading && icon && <span className="w-4 h-4">{icon}</span>}

      {/* Content */}
      <span className={loading ? "opacity-70" : ""}>{children}</span>
    </button>
  );
}

// Add ripple keyframe to global styles via CSS-in-JS
if (typeof document !== "undefined") {
  const styleId = "button-ripple-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes ripple-effect {
        to {
          transform: scale(40);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
}


