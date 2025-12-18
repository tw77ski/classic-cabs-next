// Corporate Section Layout
// Wraps all /corporate/* pages with auth and sidebar

import CorporateLayout from "@/components/corporate/CorporateLayout";

export default function CorporateSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CorporateLayout>{children}</CorporateLayout>;
}








