import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleName } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_DEMO_PASSWORD;

if (!connectionString) throw new Error("DATABASE_URL is required to seed the database.");
if (!seedPassword || seedPassword.length < 12) {
  throw new Error("Set a private SEED_DEMO_PASSWORD of at least 12 characters in .env before seeding.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const [researcherRole, adminRole] = await Promise.all([
    prisma.role.upsert({ where: { name: RoleName.RESEARCHER }, update: {}, create: { name: RoleName.RESEARCHER } }),
    prisma.role.upsert({ where: { name: RoleName.ADMIN }, update: {}, create: { name: RoleName.ADMIN } })
  ]);
  const researcher = await prisma.user.upsert({
    where: { email: "researcher.demo@ledger.local" },
    update: { displayName: "Riya Researcher", passwordHash },
    create: { email: "researcher.demo@ledger.local", displayName: "Riya Researcher", passwordHash }
  });
  const admin = await prisma.user.upsert({
    where: { email: "admin.demo@ledger.local" },
    update: { displayName: "Arun Admin", passwordHash },
    create: { email: "admin.demo@ledger.local", displayName: "Arun Admin", passwordHash }
  });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: researcher.id, roleId: researcherRole.id } }, update: {}, create: { userId: researcher.id, roleId: researcherRole.id } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } }, update: {}, create: { userId: admin.id, roleId: adminRole.id } });
  console.log("Seeded roles and two local demo accounts. The password remains only in your ignored .env file.");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
