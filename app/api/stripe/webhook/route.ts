import { getStripe, hasStripeKey } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/webhook";

export async function POST(request: Request) {
  if (!hasStripeKey() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Billing is not set up on this server." }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });
  const body = await request.text();
  try {
    const event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    await handleStripeEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook.";
    console.error("Stripe webhook failed", error);
    return Response.json({ error: message }, { status: 400 });
  }
}
