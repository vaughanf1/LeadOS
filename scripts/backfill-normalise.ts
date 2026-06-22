/**
 * One-off backfill: re-parse age / propertyValue / mortgageRemaining for every
 * existing lead from its stored rawPayload using the fixed numeric parser, then
 * recompute the quality score + band.
 *
 * Why: the old parser dropped "k"/"m" suffixes, so "£100k-£150k remaining" was
 * stored as £125 (1000× too small), which also corrupted the quality score.
 * Display now reads the verbatim answer from rawPayload, but the integer columns
 * still drive scoring, so they need correcting for historical leads.
 *
 * Run:  npx tsx scripts/backfill-normalise.ts          (dry run — shows changes)
 *       npx tsx scripts/backfill-normalise.ts --apply  (writes changes)
 */
import { PrismaClient } from "@prisma/client";
import { flattenRaw, normaliseFlat } from "../src/lib/facebook";
import { scoreLead } from "../src/lib/scoring";
import { getAllSettings } from "../src/lib/settings";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const settings = await getAllSettings();
  const thresholds = settings["scoring.thresholds"];

  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      fullName: true,
      age: true,
      propertyValue: true,
      mortgageRemaining: true,
      urgency: true,
      qualityScore: true,
      qualityBand: true,
      rawPayload: true,
    },
  });

  let changed = 0;
  for (const l of leads) {
    if (!l.rawPayload) continue;
    const flat = flattenRaw(l.rawPayload);
    const n = normaliseFlat(flat, null, l.rawPayload as object);

    const breakdown = scoreLead(
      {
        age: n.age,
        propertyValue: n.propertyValue,
        mortgageRemaining: n.mortgageRemaining,
        urgency: l.urgency,
      },
      thresholds
    );

    const numericChanged =
      n.age !== l.age ||
      n.propertyValue !== l.propertyValue ||
      n.mortgageRemaining !== l.mortgageRemaining;
    const scoreChanged =
      breakdown.total !== l.qualityScore || breakdown.band !== l.qualityBand;

    if (!numericChanged && !scoreChanged) continue;
    changed++;

    console.log(
      `${l.fullName.padEnd(18)} ` +
        `age ${l.age}→${n.age}  prop ${l.propertyValue}→${n.propertyValue}  ` +
        `mort ${l.mortgageRemaining}→${n.mortgageRemaining}  ` +
        `score ${l.qualityScore}→${breakdown.total}  band ${l.qualityBand}→${breakdown.band}`
    );

    if (APPLY) {
      await prisma.lead.update({
        where: { id: l.id },
        data: {
          age: n.age,
          propertyValue: n.propertyValue,
          mortgageRemaining: n.mortgageRemaining,
          qualityScore: breakdown.total,
          qualityBand: breakdown.band,
        },
      });
    }
  }

  console.log(
    `\n${changed} of ${leads.length} leads ${APPLY ? "updated" : "would change"}.` +
      (APPLY ? "" : "  Re-run with --apply to write.")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
