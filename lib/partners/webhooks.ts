import "server-only";
import { db } from "@/lib/db";
import { reportEnded } from "./finish";
import { signPartnerWebhook } from "./signature";
import { partnerVideoView, startPartnerFinish } from "./videos";

/** Statuses a partner hears about: the ones a video ends in. */
const REPORTED = new Set(["succeeded", "failed", "canceled"]);

/** Seconds to wait before each retry. After the last, the delivery stays failed and the partner can poll. */
const RETRY_SECONDS = [30, 120, 600, 1800, 7200];

/** How long a partner has to answer. */
const TIMEOUT_MS = 30_000;

/**
 * Records that a partner's user's video ended, then tries to tell the partner. Each change is
 * recorded once, so a retried job or a second worker never reports it twice.
 */
export const notifyPartnerOfVideo = async (jobId: string, status: string) => {
  if (!REPORTED.has(status)) return;
  const job = await db.videoJob.findUnique({
    where: { id: jobId },
    select: { user: { select: { partnerId: true, partner: { select: { webhookUrl: true, active: true } } } } },
  });
  const partnerId = job?.user.partnerId;
  if (!partnerId || !job.user.partner?.active) return;
  const eventKey = `${jobId}:${status}`;
  const existing = await db.partnerWebhookDelivery.findUnique({ where: { eventKey }, select: { id: true } });
  if (existing) return;
  const delivery = await db.partnerWebhookDelivery
    .create({ data: { partnerId, jobId, status, eventKey } })
    .catch(() => null); // Another process recorded it first.
  if (!delivery) return;
  // Only the process that recorded this change gets here, so a follow-up is never started twice.
  const webhookUrl = job.user.partner.webhookUrl;
  await reportEnded(status, {
    startFinish: () => startPartnerFinish(jobId),
    deliver: async () => {
      if (webhookUrl) await deliver(delivery.id);
    },
  });
};

/** The webhook body: the video as the partner reads it from GET /videos/:id, with its user's id. */
const payloadFor = async (jobId: string) => {
  const job = await db.videoJob.findUnique({
    where: { id: jobId },
    select: { userId: true, user: { select: { partnerLink: { select: { externalUserId: true } } } } },
  });
  if (!job?.user.partnerLink) return null;
  const video = await partnerVideoView(job.userId, jobId);
  if (!video) return null;
  return { event: "video.updated", userId: job.user.partnerLink.externalUserId, video };
};

/** One attempt at one delivery. A failure schedules the next try. */
const deliver = async (deliveryId: string) => {
  const delivery = await db.partnerWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { partner: { select: { webhookUrl: true, webhookSecret: true } } },
  });
  if (!delivery || delivery.deliveredAt || !delivery.partner.webhookUrl || !delivery.partner.webhookSecret) return;
  const payload = await payloadFor(delivery.jobId);
  if (!payload) return;
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  let error: string | null = null;
  try {
    const response = await fetch(delivery.partner.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Signature": signPartnerWebhook(delivery.partner.webhookSecret, timestamp, body),
        "X-Event-Id": delivery.eventKey,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) error = `HTTP ${response.status}`;
  } catch (cause) {
    error = cause instanceof Error ? cause.message.slice(0, 200) : "Delivery failed";
  }
  const attempts = delivery.attempts + 1;
  const wait = RETRY_SECONDS[attempts - 1];
  await db.partnerWebhookDelivery.update({
    where: { id: delivery.id },
    data: error
      ? { attempts, lastError: error, nextTryAt: wait ? new Date(Date.now() + wait * 1000) : new Date(8.64e15) }
      : { attempts, lastError: null, deliveredAt: new Date() },
  });
};

/** Retries deliveries whose next try is due. The worker runs this every few seconds. */
export const retryPartnerWebhooks = async (limit = 20) => {
  const due = await db.partnerWebhookDelivery.findMany({
    where: { deliveredAt: null, nextTryAt: { lte: new Date() }, attempts: { gt: 0, lte: RETRY_SECONDS.length } },
    orderBy: { nextTryAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const row of due) await deliver(row.id).catch((error) => console.error("Partner webhook retry failed", error));
  return due.length;
};
