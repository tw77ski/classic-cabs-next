// Corporate Session API - Uses Auth.js session
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        company: null,
      });
    }

    // Get company info from database
    const companyId = (session.user as any).taxiCallerCompanyId;
    let companyName = "Classic Cabs Jersey";
    
    if (companyId) {
      const company = await prisma.taxiCallerCompany.findUnique({
        where: { id: companyId },
      });
      if (company) {
        companyName = company.name;
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: (session.user as any).role || "USER",
      },
      company: {
        id: String(companyId || ""),
        name: companyName,
        taxiCallerAccountId: companyId || 0,
      },
    });
  } catch (error) {
    console.error("[Session API] Error:", error);
    return NextResponse.json({
      authenticated: false,
      user: null,
      company: null,
    });
  }
}
