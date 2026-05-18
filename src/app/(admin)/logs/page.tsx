import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const logs = await prisma.leadLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { lead: true },
  });

  return (
    <>
      <PageHeader title="Logs" subtitle="Every decision made for every lead." />
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Level</th>
              <th>Lead</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-ink-muted">{formatDateTime(l.createdAt)}</td>
                <td>
                  <span
                    className={
                      l.level === "error"
                        ? "text-danger"
                        : l.level === "warn"
                          ? "text-warning"
                          : "text-ink-muted"
                    }
                  >
                    {l.level}
                  </span>
                </td>
                <td>
                  {l.lead ? (
                    <Link href={`/leads/${l.lead.id}`} className="hover:underline">
                      {l.lead.fullName}
                    </Link>
                  ) : (
                    <span className="text-ink-soft">—</span>
                  )}
                </td>
                <td className="text-sm">{l.message}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-10 text-ink-muted">
                  No log entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
