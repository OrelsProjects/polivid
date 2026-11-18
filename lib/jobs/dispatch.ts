import "server-only";

/**
 * Where videos and productions are made.
 *
 * By default the web server makes them itself, which only works while it stays up (a laptop running
 * `next dev`). With VIDEO_WORKER=external the web server only queues work, and the worker process
 * (scripts/worker.ts, which sets POLIVID_WORKER_PROCESS=1) picks it up from the database.
 */
export const runsJobsHere = () => process.env.VIDEO_WORKER !== "external" || process.env.POLIVID_WORKER_PROCESS === "1";

/**
 * Marks a running video for the worker to pick up now. Retrying, resuming, or switching models sets a
 * video running with a fresh heartbeat, which would otherwise make the worker wait for it to look stalled.
 * Stored in the otherwise unused triggerRunId column.
 */
export const WORKER_HANDOFF = "worker-handoff";

/** Starts this video in this process, or hands it to the worker when a separate worker makes videos. */
export const kickVideoJob = (userId: string, jobId: string, label = "Video stopped") => {
  if (!runsJobsHere()) {
    // A queued video needs nothing: the worker picks those up on its own.
    void import("@/lib/db")
      .then(({ db }) => db.videoJob.updateMany({ where: { id: jobId, userId, status: "running" }, data: { triggerRunId: WORKER_HANDOFF } }))
      .catch((error) => console.error("Could not hand the video to the worker", error));
    return;
  }
  // Loaded on demand: the renderer behind the worker can't load on every host, and routes shouldn't need it to start.
  void import("@/lib/video/worker")
    .then(({ startVideoJob }) => startVideoJob(userId, jobId))
    .catch((error) => {
      console.error(label, error);
    });
};

/**
 * For a page checking on a video: picks it back up in this process if nothing else is working on it.
 * Does nothing when a separate worker makes videos.
 */
export const kickVideoJobIfFree = (userId: string, jobId: string) => {
  if (!runsJobsHere()) return;
  void import("@/lib/video/worker")
    .then(({ resumeVideoJobIfFree }) => resumeVideoJobIfFree(userId, jobId))
    .catch((error) => {
      console.error("Could not resume this video", error);
    });
};

/** Picks up this person's open videos in this process, unless a separate worker makes videos. */
export const kickOpenVideos = (userId: string) => {
  if (!runsJobsHere()) return;
  void import("@/lib/video/worker")
    .then(({ resumeOpenVideos }) => resumeOpenVideos(userId))
    .catch((error) => {
      console.error("Could not resume videos", error);
    });
};
