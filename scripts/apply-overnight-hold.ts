/**
 * Hold overnight leads until the morning release.
 *
 * Three things are needed together:
 *   1. after-hours mode = HOLD       — out-of-hours leads wait, not forwarded.
 *   2. morning release = 09:00       — released leads land in business hours so
 *                                      they distribute instead of re-holding.
 *   3. drop Kasia's 24/7 schedule    — a round-the-clock custom schedule counts
 *                                      as "available now", so every overnight
 *                                      lead was assigned to her before HOLD ever
 *                                      applied. Without removing it, HOLD does
 *                                      nothing overnight.
 *
 * Kasia stays ACTIVE/BACKEND, so she still receives in-hours LOW fallback leads
 * and keeps score visibility — she just stops being the overnight catch-all.
 *
 * Run:  npx tsx scripts/apply-overnight-hold.ts          (dry run)
 *       npx tsx scripts/apply-overnight-hold.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const afterRow = await prisma.systemSetting.findUnique({ where: { key: "afterHours.config" } });
  const after = (afterRow?.value as { mode?: string; aiAfterHoursEnabled?: boolean }) ?? {
    mode: "CRAIG",
    aiAfterHoursEnabled: false,
  };
  const hoursRow = await prisma.systemSetting.findUnique({ where: { key: "hours.working" } });
  const hours = (hoursRow?.value as Record<string, string>) ?? {
    startHHmm: "09:00",
    endHHmm: "17:00",
    morningReleaseHHmm: "08:30",
    timeZone: "Europe/London",
  };

  console.log(`after-hours mode: ${after.mode} -> HOLD`);
  console.log(`morning release:  ${hours.morningReleaseHHmm} -> 09:00`);

  const kasia = await prisma.advisor.findFirst({
    where: { name: { contains: "Kasia" } },
    include: { schedules: true },
  });
  if (kasia) {
    console.log(
      `Kasia custom schedule rows to remove: ${kasia.schedules.length} ` +
        `(she stays ${kasia.status}/${kasia.group})`
    );
  } else {
    console.log("No advisor matching 'Kasia' found.");
  }

  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to write.");
    return;
  }

  await prisma.systemSetting.upsert({
    where: { key: "afterHours.config" },
    update: { value: { ...after, mode: "HOLD" } },
    create: { key: "afterHours.config", value: { mode: "HOLD", aiAfterHoursEnabled: false } },
  });
  await prisma.systemSetting.upsert({
    where: { key: "hours.working" },
    update: { value: { ...hours, morningReleaseHHmm: "09:00" } },
    create: {
      key: "hours.working",
      value: { startHHmm: "09:00", endHHmm: "17:00", morningReleaseHHmm: "09:00", timeZone: "Europe/London" },
    },
  });
  if (kasia && kasia.schedules.length) {
    await prisma.advisorSchedule.deleteMany({ where: { advisorId: kasia.id } });
  }

  console.log("\nApplied. Overnight leads will now hold until 09:00 and distribute to on-shift advisers.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
