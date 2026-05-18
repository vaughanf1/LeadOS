import { PrismaClient } from "@prisma/client";
import { DEFAULT_SETTINGS } from "../src/lib/settings-defaults";

const prisma = new PrismaClient();

async function main() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as any },
    });
  }

  // Seed example advisors only if the table is empty.
  const count = await prisma.advisor.count();
  if (count > 0) return;

  const sarah = await prisma.advisor.create({
    data: {
      name: "Sarah",
      group: "A",
      priority: 10,
      dailyLeadCap: 2,
      preferredDelivery: "BOTH",
      acceptsHigh: true,
      acceptsMid: true,
      acceptsLow: false,
    },
  });

  const adrian = await prisma.advisor.create({
    data: {
      name: "Adrian",
      group: "A",
      priority: 20,
      dailyLeadCap: 2,
    },
  });

  const customAdvisors = ["Kevin", "Sonia", "Amy"];
  for (const name of customAdvisors) {
    const adv = await prisma.advisor.create({
      data: {
        name,
        group: "A",
        priority: 30,
        dailyLeadCap: 2,
      },
    });
    // Mon-Thu 10:00-13:30
    for (const dow of [1, 2, 3, 4]) {
      await prisma.advisorSchedule.create({
        data: {
          advisorId: adv.id,
          dayOfWeek: dow,
          startTime: "10:00",
          endTime: "13:30",
          enabled: true,
        },
      });
    }
  }

  await prisma.advisor.create({
    data: {
      name: "Steve",
      group: "B",
      priority: 50,
      dailyLeadCap: 6,
      acceptsHigh: false,
      acceptsMid: true,
      acceptsLow: true,
    },
  });

  await prisma.advisor.create({
    data: {
      name: "Craig (backend)",
      group: "BACKEND",
      priority: 99,
      dailyLeadCap: 100,
      acceptsHigh: true,
      acceptsMid: true,
      acceptsLow: true,
      weekendEnabled: true,
    },
  });

  // Silence the unused-var warning
  void sarah; void adrian;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
