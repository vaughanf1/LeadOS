import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import type {
  AdvisorGroup,
  AdvisorStatus,
  DeliveryPref,
} from "@prisma/client";

export const dynamic = "force-dynamic";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function saveAdvisor(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const data = {
    name: String(formData.get("name") ?? ""),
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    group: formData.get("group") as AdvisorGroup,
    status: formData.get("status") as AdvisorStatus,
    preferredDelivery: formData.get("preferredDelivery") as DeliveryPref,
    dailyLeadCap: Number(formData.get("dailyLeadCap") ?? 2),
    priority: Number(formData.get("priority") ?? 100),
    acceptsHigh: formData.get("acceptsHigh") === "on",
    acceptsMid: formData.get("acceptsMid") === "on",
    acceptsLow: formData.get("acceptsLow") === "on",
    weekendEnabled: formData.get("weekendEnabled") === "on",
    notes: (formData.get("notes") as string) || null,
    pausedUntil: formData.get("pausedUntil")
      ? new Date(String(formData.get("pausedUntil")))
      : null,
  };
  await prisma.advisor.update({ where: { id }, data });
  redirect(`/advisors/${id}`);
}

async function saveSchedule(formData: FormData) {
  "use server";
  const advisorId = String(formData.get("advisorId"));
  // Clear existing then re-create entries for any day with both start+end.
  await prisma.advisorSchedule.deleteMany({ where: { advisorId } });
  for (let d = 0; d < 7; d++) {
    const enabled = formData.get(`enabled_${d}`) === "on";
    if (!enabled) continue;
    const start = String(formData.get(`start_${d}`) ?? "");
    const end = String(formData.get(`end_${d}`) ?? "");
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) continue;
    await prisma.advisorSchedule.create({
      data: { advisorId, dayOfWeek: d, startTime: start, endTime: end, enabled: true },
    });
  }
  redirect(`/advisors/${advisorId}`);
}

async function deleteAdvisor(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await prisma.advisor.delete({ where: { id } });
  redirect("/advisors");
}

async function resetCount(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await prisma.advisor.update({ where: { id }, data: { leadsReceivedToday: 0 } });
  redirect(`/advisors/${id}`);
}

export default async function AdvisorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const advisor = await prisma.advisor.findUnique({
    where: { id },
    include: { schedules: { orderBy: { dayOfWeek: "asc" } } },
  });
  if (!advisor) notFound();

  const schedulesByDay = new Map(advisor.schedules.map((s) => [s.dayOfWeek, s]));

  return (
    <>
      <PageHeader
        title={advisor.name}
        subtitle={`Group ${advisor.group} · ${advisor.status}`}
        actions={<Link href="/advisors" className="btn-ghost">← Back</Link>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form action={saveAdvisor} className="card lg:col-span-2">
          <input type="hidden" name="id" value={advisor.id} />
          <div className="card-header">
            <h2 className="text-base font-semibold">Profile</h2>
          </div>
          <div className="card-body grid grid-cols-2 gap-4">
            <Field label="Name" name="name" defaultValue={advisor.name} />
            <Field label="Phone" name="phone" defaultValue={advisor.phone ?? ""} />
            <Field label="Email" name="email" defaultValue={advisor.email ?? ""} />
            <div>
              <label className="label">Group</label>
              <select name="group" className="input" defaultValue={advisor.group}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="BACKEND">Backend</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" className="input" defaultValue={advisor.status}>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="HOLIDAY">Holiday</option>
                <option value="FULL">Full</option>
              </select>
            </div>
            <div>
              <label className="label">Delivery</label>
              <select
                name="preferredDelivery"
                className="input"
                defaultValue={advisor.preferredDelivery}
              >
                <option value="SMS">SMS</option>
                <option value="EMAIL">Email</option>
                <option value="BOTH">Both</option>
              </select>
            </div>
            <Field
              label="Daily cap"
              name="dailyLeadCap"
              type="number"
              defaultValue={String(advisor.dailyLeadCap)}
            />
            <Field
              label="Priority (lower wins)"
              name="priority"
              type="number"
              defaultValue={String(advisor.priority)}
            />
            <Field
              label="Paused until"
              name="pausedUntil"
              type="date"
              defaultValue={
                advisor.pausedUntil ? advisor.pausedUntil.toISOString().slice(0, 10) : ""
              }
            />
            <div className="col-span-2 grid grid-cols-4 gap-3">
              <Check name="acceptsHigh" label="Accepts HIGH" defaultChecked={advisor.acceptsHigh} />
              <Check name="acceptsMid" label="Accepts MID" defaultChecked={advisor.acceptsMid} />
              <Check name="acceptsLow" label="Accepts LOW" defaultChecked={advisor.acceptsLow} />
              <Check
                name="weekendEnabled"
                label="Weekend"
                defaultChecked={advisor.weekendEnabled}
              />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea name="notes" className="input" rows={3} defaultValue={advisor.notes ?? ""} />
            </div>
          </div>
          <div className="px-6 pb-6 flex justify-between">
            <button formAction={deleteAdvisor} className="btn-ghost text-danger">
              Delete advisor
            </button>
            <button type="submit" className="btn-primary">Save profile</button>
          </div>
        </form>

        <div className="space-y-4">
          <form action={saveSchedule} className="card">
            <input type="hidden" name="advisorId" value={advisor.id} />
            <div className="card-header">
              <h2 className="text-base font-semibold">Custom schedule</h2>
            </div>
            <div className="card-body space-y-2">
              <p className="text-xs text-ink-muted mb-2">
                If no schedule rows are enabled, the default business hours apply.
              </p>
              {DAYS.map((d, i) => {
                const s = schedulesByDay.get(i);
                return (
                  <div key={i} className="grid grid-cols-[64px,1fr,1fr,auto] items-center gap-2">
                    <span className="text-sm">{d}</span>
                    <input
                      name={`start_${i}`}
                      defaultValue={s?.startTime ?? ""}
                      placeholder="09:00"
                      className="input"
                    />
                    <input
                      name={`end_${i}`}
                      defaultValue={s?.endTime ?? ""}
                      placeholder="17:00"
                      className="input"
                    />
                    <label className="text-xs flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        name={`enabled_${i}`}
                        defaultChecked={!!s?.enabled}
                      />
                      On
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="px-6 pb-6">
              <button type="submit" className="btn-primary w-full justify-center">
                Save schedule
              </button>
            </div>
          </form>

          <form action={resetCount} className="card">
            <input type="hidden" name="id" value={advisor.id} />
            <div className="card-body flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Today's count</div>
                <div className="text-xs text-ink-muted">
                  {advisor.leadsReceivedToday} / {advisor.dailyLeadCap}
                </div>
              </div>
              <button className="btn-secondary">Reset to 0</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} type={type} defaultValue={defaultValue} className="input" />
    </div>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}
