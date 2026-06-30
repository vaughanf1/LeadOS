/**
 * Make the overnight-hold behaviour fully production-ready.
 *
 * Three things, all idempotent:
 *
 *   1. Connor's schedules — he carries leftover round-the-clock weekend rows
 *      (Sun 00:00-23:59, Sat 00:00-23:59, Fri 13:00-23:59). A custom schedule
 *      overrides business hours, so if he is ever set ACTIVE those rows would
 *      route overnight weekend leads to him at 3am. Clamp every schedule to the
 *      working-hours window (09:00-17:00) so reactivating him is safe. Rows with
 *      no daytime overlap are removed.
 *
 *   2. Audit — report any OTHER advisor whose custom schedule reaches outside the
 *      working-hours window, so nothing slips through. (Custom schedules are an
 *      intentional override mechanism, so we only report these, not auto-change.)
 *
 *   3. Robyn Silcock — a MID lead left UNASSIGNED (status NEW) earlier today.
 *      Re-queue it as HELD so the 09:00 morning-release cron distributes it to an
 *      on-shift Group A advisor in business hours, instead of it sitting lost.
 *
 * NOTE: the weekend-night hole for weekend-ENABLED advisors with no schedule
 * (e.g. Kasia) is fixed in code (src/lib/distribution.ts) and takes effect on the
 * next Railway deploy — no data change needed for that.
 *
 * Run:  npx tsx scripts/fix-overnight-readiness.ts          (dry run)
 *       npx tsx scripts/fix-overnight-readiness.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const WORK_START = "09:00";
const WORK_END = "17:00";
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function main() {
  console.log(`Working-hours window: ${WORK_START}-${WORK_END}\n`);

  // ── 1. Clamp Connor's schedules to the working-hours window ────────────────
  const connor = await prisma.advisor.findFirst({
    where: { name: { contains: "Connor" } },
    include: { schedules: true },
  });

  if (!connor) {
    console.log("No advisor matching 'Connor' found.");
  } else {
    console.log(`Connor (${connor.status}/${connor.group}) — ${connor.schedules.length} schedule row(s):`);
    for (const s of connor.schedules) {
      const newStart = toMin(s.startTime) < toMin(WORK_START) ? WORK_START : s.startTime;
      const newEnd = toMin(s.endTime) > toMin(WORK_END) ? WORK_END : s.endTime;
      const empty = toMin(newStart) >= toMin(newEnd);
      const changed = newStart !== s.startTime || newEnd !== s.endTime;
      const action = empty ? "DELETE (no daytime overlap)" : changed ? `-> ${newStart}-${newEnd}` : "(unchanged)";
      console.log(`   ${DAY[s.dayOfWeek]} ${s.startTime}-${s.endTime}  ${action}`);

      if (APPLY && changed) {
        if (empty) {
          await prisma.advisorSchedule.delete({ where: { id: s.id } });
        } else {
          await prisma.advisorSchedule.update({
            where: { id: s.id },
            data: { startTime: newStart, endTime: newEnd },
          });
        }
      }
    }
  }

  // ── 2. Audit other advisors for out-of-window custom schedules ─────────────
  console.log("\nAudit — other advisors with schedules outside the working-hours window:");
  const others = await prisma.advisor.findMany({
    where: { NOT: { name: { contains: "Connor" } } },
    include: { schedules: true },
  });
  let flagged = 0;
  for (const a of others) {
    const bad = a.schedules.filter(
      (s) => toMin(s.startTime) < toMin(WORK_START) || toMin(s.endTime) > toMin(WORK_END)
    );
    if (bad.length) {
      flagged++;
      console.log(
        `   ⚠ ${a.name} (${a.status}): ` +
          bad.map((s) => `${DAY[s.dayOfWeek]} ${s.startTime}-${s.endTime}`).join(", ")
      );
    }
  }
  if (!flagged) console.log("   none — clean.");

  // ── 3. Re-queue RECENT stuck UNASSIGNED leads ──────────────────────────────
  // Only leads from the last 2 days are re-queued, so we don't re-send advisers
  // stale leads from days ago. Older stuck leads are reported, not touched.
  const RECENT_MS = 2 * 24 * 3600 * 1000;
  const cutoff = new Date(Date.now() - RECENT_MS);
  console.log("\nStuck UNASSIGNED leads (status NEW):");
  const stuck = await prisma.lead.findMany({
    where: { status: "NEW" },
    orderBy: { receivedAt: "asc" },
  });
  if (!stuck.length) {
    console.log("   none.");
  } else {
    for (const l of stuck) {
      const recent = l.receivedAt >= cutoff;
      const tag = recent ? "-> HELD (re-queue for 09:00 release)" : "STALE — left as-is, review manually";
      console.log(`   ${l.fullName} | ${l.qualityBand} | received ${l.receivedAt.toISOString()} | ${tag}`);
      if (APPLY && recent) {
        await prisma.lead.update({ where: { id: l.id }, data: { status: "HELD" } });
        await prisma.leadLog.create({
          data: {
            leadId: l.id,
            message: "Re-queued from UNASSIGNED to HELD for the 09:00 morning release (ops fix).",
          },
        });
      }
    }
  }

  console.log(APPLY ? "\nApplied." : "\nDry run — re-run with --apply to write.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
