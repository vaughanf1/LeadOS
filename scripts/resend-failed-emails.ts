/**
 * Resend adviser/admin emails that FAILED while Brevo was suspended.
 *
 * Re-renders each email from the lead (+ advisor, when present) so the HTML and
 * the score-visibility rule are correct, sends via the configured provider
 * (Resend in prod), and flips the notification log row to SENT on success.
 *
 * Only touches channel=EMAIL, status=FAILED. SMS failures are left alone.
 *
 * Run:  npx tsx scripts/resend-failed-emails.ts            (dry run — lists them)
 *       npx tsx scripts/resend-failed-emails.ts --apply    (actually resends)
 *       npx tsx scripts/resend-failed-emails.ts --since 2026-06-22T14:00:00Z --apply
 */
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../src/lib/notifications/email";
import { emailTemplate } from "../src/lib/notifications/templates";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const sinceArg = process.argv[process.argv.indexOf("--since") + 1];
const since = sinceArg && sinceArg !== "--apply" ? new Date(sinceArg) : null;

async function main() {
  const failed = await prisma.notificationLog.findMany({
    where: {
      channel: "EMAIL",
      status: "FAILED",
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    include: { lead: true, advisor: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(
    `${failed.length} failed email(s)${since ? ` since ${since.toISOString()}` : ""}` +
      `${APPLY ? "" : " (dry run)"}`
  );

  let sent = 0;
  let stillFailing = 0;
  for (const n of failed) {
    // Re-render from the lead when we have it, so HTML + score visibility are
    // correct. Fall back to the stored subject/body for orphaned rows.
    let subject = n.subject ?? "(no subject)";
    let text = n.body;
    let html: string | undefined;
    if (n.lead) {
      const rendered = emailTemplate(n.lead, n.advisor ?? null);
      // Preserve any prefix the original subject carried ([After-hours], ⚠️ …).
      subject = n.subject ?? rendered.subject;
      text = rendered.text;
      html = rendered.html;
    }

    console.log(`  ${n.createdAt.toISOString()} -> ${n.to}  (${n.advisor?.name ?? "admin/fallback"})`);

    if (!APPLY) continue;

    const r = await sendEmail({ to: n.to, subject, text, html });
    await prisma.notificationLog.update({
      where: { id: n.id },
      data: {
        status: r.ok ? "SENT" : "FAILED",
        attempts: { increment: 1 },
        sentAt: r.ok ? new Date() : null,
        error: r.error,
      },
    });
    if (r.ok) sent++;
    else {
      stillFailing++;
      console.log(`     ✗ still failing: ${r.error}`);
    }
  }

  if (APPLY) {
    console.log(`\nResent ${sent}; still failing ${stillFailing}.`);
  } else {
    console.log("\nDry run — re-run with --apply to send.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
