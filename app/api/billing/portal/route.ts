import { auth } from "@/auth";
import { getBalance } from "@/lib/billing/credits";
import { ensureStripeCustomer } from "@/lib/billing/customer";
import { appOrigin, getStripe, hasStripeKey } from "@/lib/billing/stripe";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to manage billing." }, { status: 401 });
  if (!hasStripeKey()) return Response.json({ error: "Billing is not set up on this server." }, { status: 503 });

  const balance = await getBalance(userId);
  if (!balance.stripeCustomerId && !session.user?.email) {
    return Response.json({ error: "Subscribe to a plan first." }, { status: 400 });
  }
  const customerId = await ensureStripeCustomer({
    id: userId,
    email: session.user?.email ?? null,
    name: session.user?.name ?? null,
    stripeCustomerId: balance.stripeCustomerId,
  });
  const portal = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appOrigin()}/billing`,
  });
  return Response.json({ url: portal.url });
}
