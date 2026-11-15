"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { declineQuoteByHash } from "@/lib/mcp/confirm";
import { publicOrigin } from "@/lib/mcp/origin";
import { runQuote } from "@/lib/mcp/server";

const QUOTE_ID = /^[a-f0-9]{64}$/;

/** Approve or decline a quote from the PoliVid page. The quote must belong to the signed-in person. */
export const decideQuote = async (formData: FormData) => {
  const session = await auth();
  const userId = session?.user?.id;
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!QUOTE_ID.test(quoteId)) redirect("/videos");
  const back = `/approve/${quoteId}`;
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(back)}`);

  if (formData.get("decision") !== "approve") {
    await declineQuoteByHash(userId, quoteId, "page");
    redirect(back);
  }
  const result = await runQuote(quoteId, { userId, origin: publicOrigin() }, "page");
  const data = (result.structuredContent ?? {}) as { jobId?: unknown; card?: { videoId?: unknown }; error?: unknown };
  const jobId = typeof data.jobId === "string" ? data.jobId : typeof data.card?.videoId === "string" ? data.card.videoId : "";
  if (result.isError || !jobId) {
    const message = typeof data.error === "string" ? data.error : "";
    redirect(message ? `${back}?error=${encodeURIComponent(message)}` : back);
  }
  redirect(`/videos/${encodeURIComponent(jobId)}`);
};
