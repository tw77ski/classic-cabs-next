import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Classic Cabs",
  description: "Classic Cabs – Premium taxi booking service",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get Plausible domain from env or use default
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const plausibleScript = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL || "https://plausible.io/js/script.js";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Plausible Analytics - Privacy-friendly, no cookie consent needed */}
        {plausibleDomain && (
          <Script
            defer
            data-domain={plausibleDomain}
            src={plausibleScript}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body 
        className="antialiased"
        style={{ 
          backgroundColor: '#1a1f1e',
          color: '#f7f1e4',
          minHeight: '100vh'
        }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
