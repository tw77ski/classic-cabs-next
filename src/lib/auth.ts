// Auth.js Configuration for Corporate Portal
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { query, isDatabaseAvailable, areCorporateTablesReady } from "./corporate/db";

// Demo users for development/fallback
const DEMO_USERS = [
  {
    id: "demo-1",
    email: "admin@democompany.je",
    password: "demo123",
    name: "Demo Admin",
    role: "admin",
    companyId: "1",
    companyName: "Demo Company Ltd",
    taxiCallerAccountId: 574252,
  },
  {
    id: "demo-2",
    email: "booker@democompany.je",
    password: "demo123",
    name: "Demo Booker",
    role: "booker",
    companyId: "1",
    companyName: "Demo Company Ltd",
    taxiCallerAccountId: 574252,
  },
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Corporate Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        // Try database first
        try {
          const dbAvailable = await isDatabaseAvailable();
          const tablesReady = dbAvailable && await areCorporateTablesReady();

          if (tablesReady) {
            const result = await query<{
              id: number;
              email: string;
              password_hash: string;
              name: string;
              role: string;
              company_id: number;
              company_name: string;
              taxicaller_account_id: number;
            }>(`
              SELECT 
                u.id, u.email, u.password_hash, u.name, u.role, u.company_id,
                c.name as company_name, c.taxicaller_account_id
              FROM corporate_users u
              JOIN corporate_companies c ON u.company_id = c.id
              WHERE LOWER(u.email) = LOWER($1) AND u.active = true AND c.active = true
            `, [email]);

            if (result.rows.length > 0) {
              const user = result.rows[0];
              const isValid = await bcrypt.compare(password, user.password_hash);
              
              if (isValid) {
                // Update last login
                await query(`UPDATE corporate_users SET last_login = NOW() WHERE id = $1`, [user.id]);
                
                console.log(`[Auth.js] DB login successful: ${email}`);
                return {
                  id: String(user.id),
                  email: user.email,
                  name: user.name,
                  role: user.role,
                  companyId: String(user.company_id),
                  companyName: user.company_name,
                  taxiCallerAccountId: user.taxicaller_account_id,
                };
              }
            }
          }
        } catch (error) {
          console.error("[Auth.js] Database error:", error);
        }

        // Fallback to demo users
        const demoUser = DEMO_USERS.find(
          (u) => u.email === email && u.password === password
        );

        if (demoUser) {
          console.log(`[Auth.js] Demo login: ${email}`);
          return {
            id: demoUser.id,
            email: demoUser.email,
            name: demoUser.name,
            role: demoUser.role,
            companyId: demoUser.companyId,
            companyName: demoUser.companyName,
            taxiCallerAccountId: demoUser.taxiCallerAccountId,
          };
        }

        console.log(`[Auth.js] Login failed: ${email}`);
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
        token.taxiCallerAccountId = user.taxiCallerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
        session.user.companyId = token.companyId as string;
        session.user.companyName = token.companyName as string;
        session.user.taxiCallerAccountId = token.taxiCallerAccountId as number;
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

// Type augmentation for session
declare module "next-auth" {
  interface User {
    role?: string;
    companyId?: string;
    companyName?: string;
    taxiCallerAccountId?: number;
  }
  interface Session {
    user: User & {
      id: string;
      role: string;
      companyId: string;
      companyName: string;
      taxiCallerAccountId: number;
    };
  }
}

