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
            <h2 className="text-base font-semibold">Scoring</h2>
          </div>
          <div className="card-body space-y-4 text-sm">
            <div>
              <div className="text-ink-muted text-xs uppercase mb-1">Bands</div>
              HIGH ≥ {s["scoring.thresholds"].highMin} · MID ≥ {s["scoring.thresholds"].midMin} · otherwise LOW
            </div>
            <RulesBlock title="Age">
              {s["scoring.thresholds"].ageBands.map((b, i) => (
                <li key={i}>
                  {b.min}-{b.max === 200 ? "+" : b.max}: <strong>{b.points > 0 ? "+" : ""}{b.points}</strong>
                </li>
              ))}
            </RulesBlock>
            <RulesBlock title="Mortgage remaining">
              {s["scoring.thresholds"].mortgageBands.map((b, i) => (
                <li key={i}>
                  ≤ £{b.maxPounds === Number.MAX_SAFE_INTEGER ? "∞" : b.maxPounds.toLocaleString()}:{" "}
                  <strong>{b.points > 0 ? "+" : ""}{b.points}</strong>
                </li>
              ))}
            </RulesBlock>
            <RulesBlock title="Urgency">
              {Object.entries(s["scoring.thresholds"].urgencyPoints).map(([k, v]) => (
                <li key={k}>
                  {k}: <strong>{v > 0 ? "+" : ""}{v}</strong>
                </li>
              ))}
            </RulesBlock>
            <RulesBlock title="Property value">
              {s["scoring.thresholds"].propertyValueBands.map((b, i) => (
                <li key={i}>
                  ≥ £{b.minPounds.toLocaleString()}: <strong>{b.points > 0 ? "+" : ""}{b.points}</strong>
                </li>
              ))}
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
