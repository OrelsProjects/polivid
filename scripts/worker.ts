/**
 * The always-on worker that makes videos and productions, so they finish with no browser open
 * and no laptop running. The web app (with VIDEO_WORKER=external) only queues the work.
 *
 *   npm run worker                    run until stopped
 *   npm run worker -- --dry-run       list what it would pick up, start nothing, exit
 *
 * It picks up every queued video, and running ones with no heartbeat for RUNNING_TAKEOVER_MS (3 minutes),
 * which covers a video left behind by a restart or by the web server before the switch.
 * Queued videos are claimed with an atomic queued→running update, so two processes never both start one.
 */
process.env.POLIVID_WORKER_PROCESS = "1";

const POLL_MS = 5_000;
const PRODUCTION_TICK_MS = 2_000;
const STATUS_LOG_MS = 60_000;
const MAX_PICKUP = 10;

const dryRun = process.argv.includes("--dry-run");

const log = (message: string, extra?: Record<string, unknown>) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), message, ...extra }));

const main = async () => {
  const worker = await import("@/lib/video/worker");
  const STALE_MS = worker.RUNNING_TAKEOVER_MS;

  if (dryRun) {
    const jobs = await worker.findOpenVideosToPickUp(STALE_MS, 50);
    log("Dry run: these videos would be picked up", {
      count: jobs.length,
      jobs: jobs.map((job) => ({ id: job.id, status: job.status, step: job.currentStep, heartbeatAt: job.heartbeatAt })),
    });
    const { db } = await import("@/lib/db");
    await db.$disconnect();
    return;
  }

  const { tickProductionJobs } = await import("@/lib/production/jobs/runner");
  let stopping = false;
  log("Worker started", { pid: process.pid, pollMs: POLL_MS, staleMs: STALE_MS });
  // Build the Remotion bundle now, so the first editor export after a deploy doesn't wait for it.
  void import("@/lib/editor/render").then(({ warmRemotionBundle }) => warmRemotionBundle());

  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    try {
      const released = await worker.releaseRuns();
      log("Worker stopping", { signal, released });
    } catch (error) {
      console.error("Could not release videos on shutdown", error);
    }
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));

  const productionTimer = setInterval(() => {
    if (!stopping) void tickProductionJobs().catch((error) => console.error("Production tick failed", error));
  }, PRODUCTION_TICK_MS);
  productionTimer.unref();

  // Partner webhooks that didn't land are tried again on a backoff.
  const { retryPartnerWebhooks } = await import("@/lib/partners/webhooks");
  const webhookTimer = setInterval(() => {
    if (!stopping) void retryPartnerWebhooks().catch((error) => console.error("Partner webhook retries failed", error));
  }, PRODUCTION_TICK_MS);
  webhookTimer.unref();

  let lastStatus = 0;
  while (!stopping) {
    try {
      const started = await worker.pickUpOpenVideos(STALE_MS, MAX_PICKUP);
      if (started > 0) log("Picked up videos", { started, running: worker.activeRunCount() });
    } catch (error) {
      console.error("Could not look for videos", error);
    }
    if (Date.now() - lastStatus > STATUS_LOG_MS) {
      lastStatus = Date.now();
      log("Worker alive", { running: worker.activeRunCount(), rssMb: Math.round(process.memoryUsage().rss / 1e6) });
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
};

process.on("unhandledRejection", (error) => console.error("Unhandled rejection", error));

main().catch((error) => {
  console.error("Worker crashed", error);
  process.exit(1);
});
