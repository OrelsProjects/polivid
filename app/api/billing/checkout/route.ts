import { z } from "zod";
import { auth } from "@/auth";
import { ensureStripeCustomer } from "@/lib/billing/customer";
import { getBalance } from "@/lib/billing/credits";
import { isBillingInterval, isPaidPlanId, isTopupId, lookupKeyForPlan, topupById } from "@/lib/billing/plans";
import { appOrigin, checkoutSuffix, getStripe, hasStripeKey, priceByLookupKey } from "@/lib/billing/stripe";

const Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"),
    plan: z.string(),
    interval: z.string(),
  }),
  z.object({
    kind: z.literal("topup"),
    pack: z.string(),
  }),
]);

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to pick a plan." }, { status: 401 });
  if (!hasStripeKey()) return Response.json({ error: "Billing is not set up on this server." }, { status: 503 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  const balance = await getBalance(userId);
  const stripe = getStripe();
  const origin = appOrigin();

  if (parsed.data.kind === "plan") {
    if (!isPaidPlanId(parsed.data.plan) || !isBillingInterval(parsed.data.interval)) {
      return Response.json({ error: "Pick a plan." }, { status: 400 });
    }
    if (balance.subscriptionId && (balance.subscriptionStatus === "active" || balance.subscriptionStatus === "trialing")) {
      const customerId = await ensureStripeCustomer({
        id: userId,
        email: session.user?.email ?? null,
        name: session.user?.name ?? null,
        stripeCustomerId: balance.stripeCustomerId,
      });
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/billing`,
      });
      return Response.json({ url: portal.url, via: "portal" });
    }
    const lookupKey = lookupKeyForPlan(parsed.data.plan, parsed.data.interval);
    if (!lookupKey) return Response.json({ error: "That plan is missing." }, { status: 400 });
    const price = await priceByLookupKey(lookupKey);
    if (!price) return Response.json({ error: "That plan is not in Stripe yet." }, { status: 500 });
    const customerId = await ensureStripeCustomer({
      id: userId,
      email: session.user?.email ?? null,
      name: session.user?.name ?? null,
      stripeCustomerId: balance.stripeCustomerId,
    });
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      success_url: `${origin}/billing?status=success`,
      cancel_url: `${origin}/billing?status=cancel`,
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { userId, kind: "plan", plan: parsed.data.plan, interval: parsed.data.interval },
      subscription_data: { metadata: { userId, plan: parsed.data.plan } },
      integration_identifier: `polivid-plan-${checkoutSuffix()}`,
    });
    if (!checkout.url) return Response.json({ error: "Couldn't start checkout." }, { status: 500 });
    return Response.json({ url: checkout.url });
  }

  if (!isTopupId(parsed.data.pack)) return Response.json({ error: "Pick a credit pack." }, { status: 400 });
  const pack = topupById(parsed.data.pack);
  if (!pack) return Response.json({ error: "Pick a credit pack." }, { status: 400 });
  const price = await priceByLookupKey(pack.lookupKey);
  if (!price) return Response.json({ error: "That pack is not in Stripe yet." }, { status: 500 });
  const customerId = await ensureStripeCustomer({
    id: userId,
    email: session.user?.email ?? null,
    name: session.user?.name ?? null,
    stripeCustomerId: balance.stripeCustomerId,
  });
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    client_reference_id: userId,
    success_url: `${origin}/billing?status=success`,
    cancel_url: `${origin}/billing?status=cancel`,
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { userId, kind: "topup", pack: pack.id, credits: String(pack.credits) },
    integration_identifier: `polivid-topup-${checkoutSuffix()}`,
  });
  if (!checkout.url) return Response.json({ error: "Couldn't start checkout." }, { status: 500 });
  return Response.json({ url: checkout.url });
}
