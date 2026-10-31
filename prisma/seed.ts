import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPgAdapter } from "../src/lib/postgres";
import { PrismaClient, RoleName } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_DEMO_PASSWORD;

if (!connectionString)
  throw new Error("DATABASE_URL is required to seed the database.");
if (!seedPassword || seedPassword.length < 12) {
  throw new Error(
    "Set a private SEED_DEMO_PASSWORD of at least 12 characters in .env before seeding.",
  );
}

const prisma = new PrismaClient({
  adapter: createPgAdapter(connectionString),
});

async function main() {
  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const [researcherRole, adminRole] = await Promise.all([
    prisma.role.upsert({
      where: { name: RoleName.RESEARCHER },
      update: {},
      create: { name: RoleName.RESEARCHER },
    }),
    prisma.role.upsert({
      where: { name: RoleName.ADMIN },
      update: {},
      create: { name: RoleName.ADMIN },
    }),
  ]);
  const researcher = await prisma.user.upsert({
    where: { email: "researcher.demo@ledger.local" },
    update: { displayName: "Riya Researcher", passwordHash },
    create: {
      email: "researcher.demo@ledger.local",
      displayName: "Riya Researcher",
      passwordHash,
    },
  });
  const admin = await prisma.user.upsert({
    where: { email: "admin.demo@ledger.local" },
    update: { displayName: "Arun Admin", passwordHash },
    create: {
      email: "admin.demo@ledger.local",
      displayName: "Arun Admin",
      passwordHash,
    },
  });
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: researcher.id, roleId: researcherRole.id },
    },
    update: {},
    create: { userId: researcher.id, roleId: researcherRole.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });
  if (process.argv.includes("--demo")) {
    const second = await prisma.user.upsert({
      where: { email: "researcher.second@ledger.local" },
      update: { displayName: "Second Researcher", passwordHash },
      create: {
        email: "researcher.second@ledger.local",
        displayName: "Second Researcher",
        passwordHash,
      },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: second.id, roleId: researcherRole.id },
      },
      update: {},
      create: { userId: second.id, roleId: researcherRole.id },
    });
    for (const [id, reporterId, title] of [
      [
        "a1000000-0000-4000-8000-000000000001",
        researcher.id,
        "Demo: search input validation",
      ],
      [
        "a1000000-0000-4000-8000-000000000002",
        second.id,
        "Demo: account visibility check",
      ],
    ])
      await prisma.vulnerabilityReport.upsert({
        where: { id },
        update: {},
        create: {
          id,
          reporterId,
          title,
          description:
            "Sanitized local demonstration of report ownership and remediation tracking.",
          affectedAsset: "demo.local",
          severity: "HIGH",
        },
      });
  }
  console.log(
    "Seeded roles and local demo accounts. The password remains only in your ignored .env file.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
