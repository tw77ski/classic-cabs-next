// Confetti Celebration Component
// Shows confetti burst on booking success

"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  velocity: { x: number; y: number };
  rotationSpeed: number;
  opacity: number;
  shape: "square" | "circle" | "triangle";
}

interface ConfettiProps {
  isActive: boolean;
  onComplete?: () => void;
  particleCount?: number;
  duration?: number;
  colors?: string[];
}

const DEFAULT_COLORS = [
  "#ffd55c", // Gold
  "#ffcc33", // Bright gold
  "#c9a962", // Muted gold
  "#4ade80", // Success green
  "#f5f5f5", // White
  "#a68b45", // Dark gold
];

export default function Confetti({
  isActive,
  onComplete,
  particleCount = 50,
  duration = 3000,
  colors = DEFAULT_COLORS,
}: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const wasActiveRef = useRef(isActive);
  const animationRef = useRef<number | undefined>(undefined);

  const createParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    const shapes: Particle["shape"][] = ["square", "circle", "triangle"];

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 20, // Start near center
        y: 40 + (Math.random() - 0.5) * 10,
        rotation: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        velocity: {
          x: (Math.random() - 0.5) * 15,
          y: -8 - Math.random() * 12, // Upward burst
        },
        rotationSpeed: (Math.random() - 0.5) * 20,
        opacity: 1,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      });
    }

    return newParticles;
  }, [particleCount, colors]);

  useEffect(() => {
    // Clear when transitioning from active to inactive
    if (!isActive && wasActiveRef.current) {
      wasActiveRef.current = false;
      queueMicrotask(() => setParticles([]));
      return;
    }
    
    if (!isActive) {
      return;
    }

    wasActiveRef.current = true;
    // Defer initial particles creation to avoid sync setState in effect
    queueMicrotask(() => setParticles(createParticles()));

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setParticles((prev) =>
        prev.map((particle) => ({
          ...particle,
          x: particle.x + particle.velocity.x * 0.3,
          y: particle.y + particle.velocity.y * 0.3 + progress * 8, // Add gravity
          rotation: particle.rotation + particle.rotationSpeed,
          velocity: {
            x: particle.velocity.x * 0.98, // Slow down
            y: particle.velocity.y + 0.3, // Gravity
          },
          opacity: Math.max(0, 1 - progress * 1.2),
        }))
      );

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, createParticles, duration, onComplete]);

  if (!isActive || particles.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[100] overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            backgroundColor:
              particle.shape !== "triangle" ? particle.color : "transparent",
            borderRadius: particle.shape === "circle" ? "50%" : "2px",
            transform: `rotate(${particle.rotation}deg)`,
            opacity: particle.opacity,
            transition: "none",
            ...(particle.shape === "triangle" && {
              width: 0,
              height: 0,
              borderLeft: `${particle.size / 2}px solid transparent`,
              borderRight: `${particle.size / 2}px solid transparent`,
              borderBottom: `${particle.size}px solid ${particle.color}`,
              backgroundColor: "transparent",
            }),
          }}
        />
      ))}
    </div>
  );
}

// Hook for easy confetti triggering
export function useConfetti() {
  const [isActive, setIsActive] = useState(false);

  const trigger = useCallback(() => {
    setIsActive(true);
  }, []);

  const reset = useCallback(() => {
    setIsActive(false);
  }, []);

  return { isActive, trigger, reset };
}


