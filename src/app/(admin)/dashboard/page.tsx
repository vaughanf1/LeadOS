import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill, qualityVariant, leadStatusVariant } from "@/components/StatusPill";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

function startOfTodayUK(): Date {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return new Date(`${y}-${m}-${d}T00:00:00Z`); // midnight UK ≈ midnight UTC during winter; tolerable for dashboard windowing
}

export default async function DashboardPage() {
  const since = startOfTodayUK();

  const [
    leadsToday,
    assignedToday,
    bandSplit,
    advisors,
    unassigned,
    afterHours,
    failed,
    recent,
  ] = await Promise.all([
    prisma.lead.count({ where: { receivedAt: { gte: since } } }),
    prisma.lead.count({
      where: { receivedAt: { gte: since }, status: { in: ["ASSIGNED", "SENT"] } },
    }),
    prisma.lead.groupBy({
      by: ["qualityBand"],
      where: { receivedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.advisor.findMany({ orderBy: [{ group: "asc" }, { priority: "asc" }] }),
    prisma.lead.count({ where: { status: "NEW" } }),
    prisma.lead.count({ where: { status: { in: ["AFTER_HOURS", "HELD"] } } }),
    prisma.notificationLog.count({ where: { status: "FAILED" } }),
    prisma.lead.findMany({
      orderBy: { receivedAt: "desc" },
      take: 6,
      include: { assignments: { include: { advisor: true } } },
    }),
  ]);

  const byBand = Object.fromEntries(bandSplit.map((b) => [b.qualityBand, b._count._all]));

  const stats = [
    { label: "Leads today", value: leadsToday, hint: `${assignedToday} assigned` },
    { label: "High", value: byBand.HIGH ?? 0 },
    { label: "Mid", value: byBand.MID ?? 0 },
    { label: "Low", value: byBand.LOW ?? 0 },
    { label: "Unassigned", value: unassigned, variant: unassigned > 0 ? "warning" : "neutral" },
    { label: "After-hours / held", value: afterHours },
    { label: "Failed notifications", value: failed, variant: failed > 0 ? "danger" : "neutral" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Today at a glance — UK time"
        actions={
          <Link href="/leads/new" className="btn-primary">
            + Test lead
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-xs uppercase tracking-wide text-ink-muted">{s.label}</div>
            <div className="text-2xl font-semibold mt-1">{s.value}</div>
            {s.hint && <div className="text-xs text-ink-soft mt-1">{s.hint}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="text-base font-semibold">Recent leads</h2>
            <Link href="/leads" className="text-sm text-brand hover:underline">View all</Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Name</th>
                <th>Quality</th>
                <th>Advisor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((l) => (
                <tr key={l.id}>
                  <td className="text-ink-muted">{formatDateTime(l.receivedAt)}</td>
                  <td>
                    <Link href={`/leads/${l.id}`} className="hover:underline">
                      {l.fullName}
                    </Link>
                  </td>
                  <td>
                    {l.qualityBand ? (
                      <StatusPill variant={qualityVariant(l.qualityBand)}>{l.qualityBand}</StatusPill>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="text-ink-muted">
                    {l.assignments.map((a) => a.advisor.name).join(", ") || "—"}
                  </td>
                  <td>
                    <StatusPill variant={leadStatusVariant(l.status)}>{l.status}</StatusPill>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-ink-muted">
                    No leads yet — try creating a test lead.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold">Advisor availability</h2>
            <Link href="/advisors" className="text-sm text-brand hover:underline">Manage</Link>
          </div>
          <div className="divide-y divide-line/60">
            {advisors.map((a) => (
              <div key={a.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-ink-muted">
                    Group {a.group} · {a.leadsReceivedToday}/{a.dailyLeadCap} today
                  </div>
                </div>
                <StatusPill
                  variant={
                    a.status === "ACTIVE" ? "success" : a.status === "PAUSED" ? "warning" : "neutral"
                  }
                >
                  {a.status}
                </StatusPill>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
