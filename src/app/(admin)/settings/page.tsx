import { redirect } from "next/navigation";
import { getAllSettings, setSetting } from "@/lib/settings";
import { PageHeader } from "@/components/PageHeader";
import type { ScoringThresholds, WorkingHours, AfterHoursConfig } from "@/lib/settings-defaults";

export const dynamic = "force-dynamic";

async function saveScoring(formData: FormData) {
  "use server";
  const current = await (await import("@/lib/settings")).getSetting("scoring.thresholds");
  const next: ScoringThresholds = {
    ...current,
    highMin: Number(formData.get("highMin") ?? current.highMin),
    midMin: Number(formData.get("midMin") ?? current.midMin),
  };
  await setSetting("scoring.thresholds", next);
  redirect("/settings");
}

async function saveHours(formData: FormData) {
  "use server";
  const next: WorkingHours = {
    startHHmm: String(formData.get("startHHmm") ?? "09:00"),
    endHHmm: String(formData.get("endHHmm") ?? "17:00"),
    morningReleaseHHmm: String(formData.get("morningReleaseHHmm") ?? "08:30"),
    timeZone: "Europe/London",
  };
  await setSetting("hours.working", next);
  redirect("/settings");
}

async function saveAfterHours(formData: FormData) {
  "use server";
  const mode = String(formData.get("mode")) as AfterHoursConfig["mode"];
  const aiAfterHoursEnabled = formData.get("aiAfterHoursEnabled") === "on";
  await setSetting("afterHours.config", { mode, aiAfterHoursEnabled });
  redirect("/settings");
}

export default async function SettingsPage() {
  const s = await getAllSettings();

  return (
    <>
      <PageHeader title="Settings" subtitle="Tune scoring, hours, and after-hours behaviour." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form action={saveScoring} className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold">Quality thresholds</h2>
          </div>
          <div className="card-body grid grid-cols-2 gap-4">
            <div>
              <label className="label">HIGH ≥</label>
              <input
                name="highMin"
                type="number"
                defaultValue={s["scoring.thresholds"].highMin}
                className="input"
              />
            </div>
            <div>
              <label className="label">MID ≥</label>
              <input
                name="midMin"
                type="number"
                defaultValue={s["scoring.thresholds"].midMin}
                className="input"
              />
            </div>
            <div className="col-span-2 text-xs text-ink-muted">
              Anything below MID is LOW. Detailed band points are configured in
              <code className="px-1">src/lib/settings-defaults.ts</code> for now.
            </div>
          </div>
          <div className="px-6 pb-6 flex justify-end">
            <button className="btn-primary">Save thresholds</button>
          </div>
        </form>

        <form action={saveHours} className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold">Working hours (UK)</h2>
          </div>
          <div className="card-body grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start</label>
              <input
                name="startHHmm"
                defaultValue={s["hours.working"].startHHmm}
                className="input"
                placeholder="09:00"
              />
            </div>
            <div>
              <label className="label">End</label>
              <input
                name="endHHmm"
                defaultValue={s["hours.working"].endHHmm}
                className="input"
                placeholder="17:00"
              />
            </div>
            <div>
              <label className="label">Morning release time</label>
              <input
                name="morningReleaseHHmm"
                defaultValue={s["hours.working"].morningReleaseHHmm}
                className="input"
                placeholder="08:30"
              />
            </div>
          </div>
          <div className="px-6 pb-6 flex justify-end">
            <button className="btn-primary">Save hours</button>
          </div>
        </form>

        <form action={saveAfterHours} className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold">After-hours handling</h2>
          </div>
          <div className="card-body space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-line cursor-pointer hover:bg-canvas-subtle/40">
              <input
                type="radio"
                name="mode"
                value="CRAIG"
                defaultChecked={s["afterHours.config"].mode === "CRAIG"}
              />
              <div>
                <div className="font-medium">Forward to Craig / admin (Mode A)</div>
                <div className="text-xs text-ink-muted">
                  SMS to <code>CRAIG_PHONE</code> + email to <code>ADMIN_EMAIL</code>.
                </div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-line cursor-pointer hover:bg-canvas-subtle/40">
              <input
                type="radio"
                name="mode"
                value="HOLD"
                defaultChecked={s["afterHours.config"].mode === "HOLD"}
              />
              <div>
                <div className="font-medium">Hold until morning (Mode B)</div>
                <div className="text-xs text-ink-muted">
                  Released at {s["hours.working"].morningReleaseHHmm} by daily cron.
                </div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-line cursor-pointer hover:bg-canvas-subtle/40">
              <input
                type="radio"
                name="mode"
                value="AI_CHATBOT"
                defaultChecked={s["afterHours.config"].mode === "AI_CHATBOT"}
              />
              <div>
                <div className="font-medium">AI chatbot follow-up (future)</div>
                <div className="text-xs text-ink-muted">
                  Holds the lead and would send an AI follow-up — disabled in MVP.
                </div>
              </div>
            </label>
            <label className="flex items-center gap-2 text-sm pt-2 border-t border-line/60">
              <input
                type="checkbox"
                name="aiAfterHoursEnabled"
                defaultChecked={s["afterHours.config"].aiAfterHoursEnabled}
              />
              Enable AI after-hours follow-up (feature flag)
            </label>
          </div>
          <div className="px-6 pb-6 flex justify-end">
            <button className="btn-primary">Save</button>
          </div>
        </form>

        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold">Environment</h2>
          </div>
          <dl className="px-6 py-4 text-sm space-y-2">
            <EnvRow k="Twilio" v={process.env.TWILIO_ACCOUNT_SID ? "Configured" : "Not set (SMS stubbed)"} />
            <EnvRow k="SMTP" v={process.env.SMTP_HOST ? "Configured" : "Not set (email stubbed to console)"} />
            <EnvRow k="Facebook token" v={process.env.FACEBOOK_PAGE_ACCESS_TOKEN ? "Configured" : "Not set"} />
            <EnvRow k="OpenAI" v={process.env.OPENAI_API_KEY ? "Configured" : "Not set (AI chat disabled)"} />
            <EnvRow k="Craig phone" v={process.env.CRAIG_PHONE ?? "—"} />
            <EnvRow k="Admin email" v={process.env.ADMIN_EMAIL ?? "—"} />
          </dl>
        </div>
      </div>
    </>
  );
}

function EnvRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
