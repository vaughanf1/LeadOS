import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill, qualityVariant, leadStatusVariant } from "@/components/StatusPill";
import { formatDateTime, formatGBP } from "@/lib/utils";
import { leadDisplayAnswers } from "@/lib/facebook";
import Link from "next/link";
import type { Prisma, LeadStatus, QualityBand } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: LeadStatus[] = [
  "NEW",
  "ASSIGNED",
  "SENT",
  "HELD",
  "AFTER_HOURS",
  "FAILED",
  "DUPLICATE",
];
const BANDS: QualityBand[] = ["HIGH", "MID", "LOW"];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; band?: string; advisor?: string }>;
}) {
  const sp = await searchParams;
  const where: Prisma.LeadWhereInput = {};
  if (sp.status && STATUSES.includes(sp.status as LeadStatus)) {
    where.status = sp.status as LeadStatus;
  }
  if (sp.band && BANDS.includes(sp.band as QualityBand)) {
    where.qualityBand = sp.band as QualityBand;
  }
  if (sp.advisor) {
    where.assignments = { some: { advisorId: sp.advisor } };
  }

  const [leads, advisors] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 200,
      include: { assignments: { include: { advisor: true } } },
    }),
    prisma.advisor.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} most recent`}
        actions={
          <Link href="/leads/new" className="btn-primary">
            + Create lead
          </Link>
        }
      />

      <form className="card mb-4 px-4 py-3 flex flex-wrap gap-2 items-center">
        <select name="status" defaultValue={sp.status ?? ""} className="input max-w-[180px]">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="band" defaultValue={sp.band ?? ""} className="input max-w-[180px]">
          <option value="">All quality</option>
          {BANDS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select name="advisor" defaultValue={sp.advisor ?? ""} className="input max-w-[220px]">
          <option value="">All advisors</option>
          {advisors.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button className="btn-secondary" type="submit">Apply</button>
        <Link href="/leads" className="btn-ghost">Clear</Link>
      </form>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Age</th>
              <th>Property</th>
              <th>Mortgage</th>
              <th>Urgency</th>
              <th>Quality</th>
              <th>Advisor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              // Show the customer's actual answers ("61-65", "£200,000 -
              // £300,000") rather than the midpoint integers used for scoring,
              // which collapse into a handful of buckets and look like demo data.
              const answers = leadDisplayAnswers(l.rawPayload);
              return (
              <tr key={l.id} className="cursor-pointer">
                <td className="text-ink-muted whitespace-nowrap">{formatDateTime(l.receivedAt)}</td>
                <td>
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                    {l.fullName}
                  </Link>
                </td>
                <td className="text-ink-muted">{l.phone ?? "—"}</td>
                <td className="whitespace-nowrap">{answers.age ?? (l.age != null ? String(l.age) : "—")}</td>
                <td className="whitespace-nowrap">{answers.propertyValue ?? formatGBP(l.propertyValue)}</td>
                <td className="whitespace-nowrap">{answers.mortgage ?? formatGBP(l.mortgageRemaining)}</td>
                <td className="text-ink-muted">{l.urgency ?? "—"}</td>
                <td>
                  {l.qualityBand ? (
                    <StatusPill variant={qualityVariant(l.qualityBand)}>{l.qualityBand}</StatusPill>
                  ) : <span className="text-ink-soft">—</span>}
                </td>
                <td className="text-ink-muted">
                  {l.assignments.map((a) => a.advisor.name).join(", ") || "—"}
                </td>
                <td>
                  <StatusPill variant={leadStatusVariant(l.status)}>{l.status}</StatusPill>
                </td>
              </tr>
              );
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-12 text-ink-muted">
                  No leads match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
