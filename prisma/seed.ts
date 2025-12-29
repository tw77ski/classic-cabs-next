// Database Seed Script
// Creates initial admin user and demo data
// Run with: npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // Create TaxiCaller company record
  const company = await prisma.taxiCallerCompany.upsert({
    where: { id: 8284 }, // Your TaxiCaller company ID
    update: {},
    create: {
      id: 8284,
      name: "Classic Cabs Jersey",
      address: "St Helier, Jersey",
      billingEmail: "billing@classiccabs.je",
    },
  });
  console.log(`✅ Company: ${company.name} (ID: ${company.id})`);

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@classiccabs.je" },
    update: {},
    create: {
      email: "admin@classiccabs.je",
      name: "System Admin",
      password: adminPassword,
      role: "ADMIN",
      taxiCallerCompanyId: company.id,
      taxiCallerRoles: ["admin", "dispatcher"],
      passwordSetAt: new Date(),
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // Create a regular user
  const userPassword = await bcrypt.hash("user123", 12);
  const user = await prisma.user.upsert({
    where: { email: "booker@classiccabs.je" },
    update: {},
    create: {
      email: "booker@classiccabs.je",
      name: "Demo Booker",
      password: userPassword,
      role: "USER",
      taxiCallerCompanyId: company.id,
      taxiCallerRoles: ["booker"],
      passwordSetAt: new Date(),
    },
  });
  console.log(`✅ User: ${user.email}`);

  console.log("\n✨ Seed complete!\n");
  console.log("Demo credentials:");
  console.log("  Admin: admin@classiccabs.je / admin123");
  console.log("  User:  booker@classiccabs.je / user123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
