/**
 * In-process cron scheduler.
 *
 * Replaces the Vercel Cron jobs (vercel.json) when hosting on Railway, where
 * the app runs as a single long-lived Node container rather than serverless
 * functions. `register()` is invoked once per server process at startup.
 *
 * Implemented as a minute-tick timer rather than a cron library: each tick we
 * read the current UK wall-clock via the app's own `ukParts` helper and fire
 * when it matches a target HH:mm (once per calendar day). This sidesteps
 * native-dependency bundling issues and is inherently BST/GMT correct.
 *
 * Each job hits the existing, tested cron route over loopback with the
 * x-cron-secret header — the same code path Vercel Cron would have triggered.
 */
export async function register() {
  // Only the Node.js server runtime — skip edge runtime and build.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron] CRON_SECRET not set — in-process scheduler disabled.");
    return;
  }

  // Guard against double-registration within one process.
  const g = globalThis as unknown as { __leadosCronStarted?: boolean };
  if (g.__leadosCronStarted) return;
  g.__leadosCronStarted = true;

  const { ukParts } = await import("@/lib/time");
  const port = process.env.PORT || "3000";
  const base = `http://127.0.0.1:${port}`;

  const jobs = [
    // Release overnight-held leads at business open. Must be at/after the
    // working-hours start (09:00) — releasing earlier would re-evaluate the
    // leads while still "out of hours" and, under after-hours HOLD mode, simply
    // hold them again.
    { hhmm: "09:00", path: "/api/cron/release-held" },
    { hhmm: "00:00", path: "/api/cron/reset-daily-counts" }, // reset advisor counters
  ];
  // Tracks the last UK date (yyyy-MM-dd) each job fired, so it runs once/day.
  const lastFired: Record<string, string> = {};

  async function fire(path: string) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { "x-cron-secret": secret as string },
      });
      console.log(`[cron] ${path} -> ${res.status} ${await res.text()}`);
    } catch (err) {
      console.error(`[cron] ${path} failed:`, err);
    }
  }

  const timer = setInterval(() => {
    const { hours, minutes, dateISO } = ukParts();
    for (const job of jobs) {
      const [h, m] = job.hhmm.split(":").map(Number);
      if (hours === h && minutes === m && lastFired[job.path] !== dateISO) {
        lastFired[job.path] = dateISO;
        void fire(job.path);
      }
    }
  }, 60_000);
  timer.unref(); // don't keep the process alive solely for the timer

  console.log("[cron] in-process scheduler started (UK time, minute-tick).");
}
