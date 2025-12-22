// Corporate Section Layout
// Wraps all /corporate/* pages with auth and sidebar

import CorporateLayout from "@/components/corporate/CorporateLayout";
import { SessionProvider } from "@/components/providers/SessionProvider";

export default function CorporateSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <CorporateLayout>{children}</CorporateLayout>
    </SessionProvider>
  );
}
