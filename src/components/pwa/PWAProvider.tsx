"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { InstallPrompt } from "./InstallPrompt";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAContextType {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  installApp: () => Promise<void>;
  dismissInstall: () => void;
}

const PWAContext = createContext<PWAContextType | null>(null);

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error("usePWA must be used within PWAProvider");
  }
  return context;
}

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check online status
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Defer initial state update
    queueMicrotask(() => setIsOnline(navigator.onLine));

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Check if already installed
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if running in standalone mode (installed PWA)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error - iOS Safari specific property
      window.navigator.standalone === true;
    
    // Defer state updates to avoid sync setState in effect
    queueMicrotask(() => {
      setIsInstalled(isStandalone);

      // Check if user previously dismissed
      const wasDismissed = localStorage.getItem("pwa-install-dismissed");
      if (wasDismissed) {
        const dismissedTime = parseInt(wasDismissed, 10);
        // Show again after 7 days
        if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
          setDismissed(true);
        }
      }
    });
  }, []);

  // Listen for install prompt
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      
      // Show prompt after user has interacted with the app
      // Delay showing to avoid immediate popup
      setTimeout(() => {
        if (!dismissed && !isInstalled) {
          setShowInstallPrompt(true);
        }
      }, 30000); // Show after 30 seconds
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [dismissed, isInstalled]);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error("Install error:", error);
    }
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    setShowInstallPrompt(false);
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  }, []);

  return (
    <PWAContext.Provider
      value={{
        isOnline,
        isInstallable,
        isInstalled,
        installApp,
        dismissInstall,
      }}
    >
      {children}
      
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-2 bg-amber-500 text-black text-center text-sm font-medium">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            </svg>
            You&apos;re offline. Some features may not work.
          </div>
        </div>
      )}
      
      {/* Install Prompt */}
      {showInstallPrompt && !isInstalled && (
        <InstallPrompt onInstall={installApp} onDismiss={dismissInstall} />
      )}
    </PWAContext.Provider>
  );
}

