import { PageHeader } from "@/components/PageHeader";
import { getAllSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const s = await getAllSettings();
  return (
    <>
      <PageHeader
        title="Distribution Rules"
        subtitle="How leads route through the system right now."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold">Lead quality</h2>
          </div>
          <div className="card-body space-y-4 text-sm">
            <p className="text-ink-muted">
              Quality is graded simply, on the customer&apos;s age and how soon
              they want to act. Property value and mortgage are recorded on the
              lead but don&apos;t affect the grade.
            </p>
            <RulesBlock title="HIGH">
              <li>65 or older <strong>and</strong> acting now (&ldquo;this month&rdquo;).</li>
            </RulesBlock>
            <RulesBlock title="MID">
              <li>60 or older <strong>and</strong> looking to act within 1–6 months.</li>
            </RulesBlock>
            <RulesBlock title="LOW">
              <li>Under 60, <strong>or</strong> just researching for now.</li>
            </RulesBlock>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold">Routing</h2>
          </div>
          <div className="card-body space-y-4 text-sm">
            <div>
              <div className="text-ink-muted text-xs uppercase mb-1">Working hours</div>
              {s["hours.working"].startHHmm}–{s["hours.working"].endHHmm} ({s["hours.working"].timeZone})
            </div>

            <div className="space-y-2">
              <div className="font-medium">HIGH leads</div>
              <ol className="list-decimal pl-5 space-y-1 text-ink-muted">
                <li>Best Group A advisor with lowest leads today.</li>
                <li>Fall back to Group B if no Group A eligible.</li>
              </ol>
            </div>
            <div className="space-y-2">
              <div className="font-medium">MID leads</div>
              <ol className="list-decimal pl-5 space-y-1 text-ink-muted">
                <li>Group A if any still have capacity.</li>
                <li>Otherwise Group B.</li>
              </ol>
            </div>
            <div className="space-y-2">
              <div className="font-medium">LOW leads</div>
              <ol className="list-decimal pl-5 space-y-1 text-ink-muted">
                <li>Group B preferred, backend fallback.</li>
              </ol>
            </div>
            <div className="space-y-2">
              <div className="font-medium">After hours ({s["afterHours.config"].mode})</div>
              <p className="text-ink-muted">
                Held leads release at {s["hours.working"].morningReleaseHHmm} via daily cron.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function RulesBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-ink-muted text-xs uppercase mb-1">{title}</div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}
