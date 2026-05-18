import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill, advisorStatusVariant } from "@/components/StatusPill";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createAdvisor(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const adv = await prisma.advisor.create({
    data: {
      name,
      group: (formData.get("group") as "A" | "B" | "BACKEND") ?? "A",
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      dailyLeadCap: Number(formData.get("dailyLeadCap") ?? 2),
    },
  });
  redirect(`/advisors/${adv.id}`);
}

export default async function AdvisorsPage() {
  const advisors = await prisma.advisor.findMany({
    orderBy: [{ group: "asc" }, { priority: "asc" }, { name: "asc" }],
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <>
      <PageHeader
        title="Advisors"
        subtitle="Configure who receives leads, when, and how."
      />

      <div className="card mb-6">
        <div className="card-header">
          <h2 className="text-base font-semibold">Add advisor</h2>
        </div>
        <form action={createAdvisor} className="card-body grid grid-cols-1 md:grid-cols-5 gap-3">
          <input name="name" placeholder="Name" required className="input md:col-span-1" />
          <input name="phone" placeholder="+44…" className="input md:col-span-1" />
          <input name="email" placeholder="email@…" className="input md:col-span-1" />
          <select name="group" className="input md:col-span-1" defaultValue="A">
            <option value="A">Group A</option>
            <option value="B">Group B</option>
            <option value="BACKEND">Backend</option>
          </select>
          <div className="flex gap-2">
            <input
              name="dailyLeadCap"
              type="number"
              defaultValue={2}
              placeholder="Cap"
              className="input flex-1"
            />
            <button className="btn-primary">Add</button>
          </div>
        </form>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Group</th>
              <th>Status</th>
              <th>Daily cap</th>
              <th>Today</th>
              <th>Delivery</th>
              <th>Accepts</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {advisors.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/advisors/${a.id}`} className="font-medium hover:underline">
                    {a.name}
                  </Link>
                  <div className="text-xs text-ink-muted">
                    {a.phone ?? "—"} · {a.email ?? "—"}
                  </div>
                </td>
                <td>
                  <StatusPill variant="neutral">{a.group}</StatusPill>
                </td>
                <td>
                  <StatusPill variant={advisorStatusVariant(a.status)}>{a.status}</StatusPill>
                </td>
                <td>{a.dailyLeadCap}</td>
                <td>{a.leadsReceivedToday}</td>
                <td className="text-ink-muted">{a.preferredDelivery}</td>
                <td className="text-xs text-ink-muted">
                  {[a.acceptsHigh && "H", a.acceptsMid && "M", a.acceptsLow && "L"]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
                <td className="text-right">
                  <Link href={`/advisors/${a.id}`} className="text-brand text-sm hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {advisors.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-ink-muted">
                  No advisors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
