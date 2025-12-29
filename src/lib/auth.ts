// Auth.js Main Configuration
// Uses JWT strategy (no database sessions) for Edge compatibility

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Corporate Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("🔐 [Auth] authorize() called");
        console.log("🔐 [Auth] credentials:", credentials?.email);
        
        if (!credentials?.email || !credentials?.password) {
          console.log("🔐 [Auth] Missing credentials");
          return null;
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        console.log("🔐 [Auth] Looking up user:", email);

        try {
          // Find user in database
          const user = await prisma.user.findUnique({
            where: { email },
          });
          console.log("🔐 [Auth] User found:", !!user);

          if (!user || !user.password) {
            console.log(`🔐 [Auth] User not found or no password: ${email}`);
            return null;
          }
          console.log("🔐 [Auth] Comparing password...");

          // Verify password
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            console.log(`[Auth] Invalid password for: ${email}`);
            return null;
          }

          // Update last login
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          console.log(`[Auth] Login successful: ${email}`);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            taxiCallerCompanyId: user.taxiCallerCompanyId,
            taxiCallerRoles: user.taxiCallerRoles,
          };
        } catch (error) {
          console.error("[Auth] Database error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in - add user data to token
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.taxiCallerCompanyId = (user as any).taxiCallerCompanyId;
        token.taxiCallerRoles = (user as any).taxiCallerRoles;
      }
      return token;
    },
    async session({ session, token }) {
      // Add token data to session
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).taxiCallerCompanyId = token.taxiCallerCompanyId;
        (session.user as any).taxiCallerRoles = token.taxiCallerRoles;
      }
      return session;
    },
  },
  pages: {
    signIn: "/corporate/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  trustHost: true,
});

// =============================================================================
// Type Augmentation for Auth.js
// =============================================================================

declare module "next-auth" {
  interface User {
    role?: string;
    taxiCallerCompanyId?: number;
    taxiCallerRoles?: string[];
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      taxiCallerCompanyId: number;
      taxiCallerRoles: string[];
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get current session (server-side)
 */
export async function getServerSession() {
  return await auth();
}

/**
 * Check if user is admin
 */
export function isAdmin(session: { user: { role: string } } | null): boolean {
  return session?.user?.role === "ADMIN";
}

/**
 * Check if user belongs to a specific TaxiCaller company
 */
export function belongsToCompany(
  session: { user: { taxiCallerCompanyId: number } } | null,
  companyId: number
): boolean {
  return session?.user?.taxiCallerCompanyId === companyId;
}
