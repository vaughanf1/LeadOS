import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill, qualityVariant, leadStatusVariant } from "@/components/StatusPill";
import { formatDateTime, formatGBP } from "@/lib/utils";
import { processLead } from "@/lib/pipeline";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function releaseHeld(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await prisma.lead.update({ where: { id }, data: { status: "NEW" } });
  await processLead(id);
  redirect(`/leads/${id}`);
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignments: { include: { advisor: true } },
      logs: { orderBy: { createdAt: "asc" } },
      notifications: true,
    },
  });
  if (!lead) notFound();

  return (
    <>
      <PageHeader
        title={lead.fullName}
        subtitle={`Received ${formatDateTime(lead.receivedAt)}`}
        actions={
          <>
            <StatusPill variant={leadStatusVariant(lead.status)}>{lead.status}</StatusPill>
            {lead.qualityBand && (
              <StatusPill variant={qualityVariant(lead.qualityBand)}>{lead.qualityBand} · {lead.qualityScore}</StatusPill>
            )}
            <Link href="/leads" className="btn-ghost">← Back</Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="text-base font-semibold">Decision log</h2>
            {(lead.status === "HELD" || lead.status === "NEW") && (
              <form action={releaseHeld}>
                <input type="hidden" name="id" value={lead.id} />
                <button type="submit" className="btn-secondary">Re-run distribution</button>
              </form>
            )}
          </div>
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-2.5">
            {lead.logs.map((log) => (
              <div key={log.id} className="text-sm">
                <span className="text-ink-soft">{formatDateTime(log.createdAt)}</span>{" "}
                <span className={log.level === "error" ? "text-danger" : log.level === "warn" ? "text-warning" : "text-ink"}>
                  {log.message}
                </span>
              </div>
            ))}
            {lead.logs.length === 0 && (
              <div className="text-ink-muted text-sm">No logs yet.</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <h2 className="text-base font-semibold">Details</h2>
            </div>
            <dl className="px-6 py-4 grid grid-cols-2 gap-y-3 text-sm">
              <Row k="Phone" v={lead.phone} />
              <Row k="Email" v={lead.email} />
              <Row k="Postcode" v={lead.postcode} />
              <Row k="Age" v={lead.age} />
              <Row k="Property" v={formatGBP(lead.propertyValue)} />
              <Row k="Mortgage" v={formatGBP(lead.mortgageRemaining)} />
              <Row k="Urgency" v={lead.urgency} />
              <Row k="Needs money for" v={lead.loanPurpose} />
              <Row k="Stage" v={lead.enquiryStage} />
              <Row k="Source" v={lead.source} />
              {lead.facebookLeadgenId && <Row k="FB leadgen" v={lead.facebookLeadgenId} />}
            </dl>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-base font-semibold">Assigned to</h2>
            </div>
            <ul className="px-6 py-4 space-y-2">
              {lead.assignments.map((a) => (
                <li key={a.id} className="text-sm flex justify-between">
                  <span>{a.advisor.name}</span>
                  <span className="text-ink-muted">Group {a.advisor.group}</span>
                </li>
              ))}
              {lead.assignments.length === 0 && (
                <li className="text-sm text-ink-muted">Not yet assigned.</li>
              )}
            </ul>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-base font-semibold">Notifications</h2>
            </div>
            <ul className="divide-y divide-line/60">
              {lead.notifications.map((n) => (
                <li key={n.id} className="px-6 py-3 text-sm flex justify-between">
                  <span>
                    <span className="text-ink-muted">{n.channel}</span> · {n.to}
                  </span>
                  <StatusPill
                    variant={n.status === "SENT" ? "success" : n.status === "FAILED" ? "danger" : "neutral"}
                  >
                    {n.status}
                  </StatusPill>
                </li>
              ))}
              {lead.notifications.length === 0 && (
                <li className="px-6 py-3 text-sm text-ink-muted">None sent.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{k}</dt>
      <dd>{v ?? "—"}</dd>
    </>
  );
}
