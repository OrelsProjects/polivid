import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { grantCredits, setPlanCredits } from "./credits";
import { addMonthsUtc } from "./math";
import { creditsFromLookupKey, planById, planFromLookupKey, type PaidPlanId } from "./plans";

const lookupKeyFromPrice = (price: Stripe.Price | string | null | undefined) => {
  if (!price || typeof price === "string") return null;
  return price.lookup_key ?? price.metadata?.plan ?? null;
};

const subscriptionPrice = (subscription: Stripe.Subscription) => subscription.items.data[0]?.price ?? null;

const periodEndFrom = (subscription: Stripe.Subscription) => {
  const itemEnd = subscription.items.data[0]?.current_period_end;
  const end = itemEnd ?? ("current_period_end" in subscription ? Number(subscription.current_period_end) : 0);
  return end ? new Date(end * 1000) : null;
};

const intervalFrom = (subscription: Stripe.Subscription) => {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  return interval === "year" ? "year" : interval === "month" ? "month" : null;
};

const userByCustomer = async (customerId: string | Stripe.Customer | Stripe.DeletedCustomer | null) => {
  const id = typeof customerId === "string" ? customerId : customerId?.id;
  if (!id) return null;
  return db.user.findFirst({ where: { stripeCustomerId: id } });
};

const userByReference = async (clientReferenceId: string | null) => {
  if (!clientReferenceId) return null;
  return db.user.findUnique({ where: { id: clientReferenceId } });
};

export const syncSubscription = async (subscription: Stripe.Subscription) => {
  const user = await userByCustomer(subscription.customer);
  if (!user) return;
  const lookupKey = lookupKeyFromPrice(subscriptionPrice(subscription));
  const planId = planFromLookupKey(lookupKey);
  const canceled = subscription.status === "canceled" || subscription.status === "unpaid";
  const plan = canceled || !planId ? "free" : planId;
  await db.user.update({
    where: { id: user.id },
    data: {
      plan,
      subscriptionId: canceled ? null : subscription.id,
      subscriptionStatus: subscription.status,
      billingInterval: canceled ? null : intervalFrom(subscription),
      currentPeriodEnd: canceled ? null : periodEndFrom(subscription),
      ...(canceled ? { planCredits: 0, creditsRefillAt: null } : {}),
    },
  });
};

const refillFromSubscription = async (userId: string, planId: PaidPlanId, eventId: string, periodEnd: Date | null) => {
  const allowance = planById(planId).credits;
  const refillAt = periodEnd && periodEnd.getTime() > Date.now() ? periodEnd : addMonthsUtc(new Date(), 1);
  await setPlanCredits(
    userId,
    allowance,
    { reason: "refill", refType: "stripe_event", refId: eventId, idempotencyKey: `refill:${eventId}` },
    { plan: planId, creditsRefillAt: refillAt },
  );
};

export const handleStripeEvent = async (event: Stripe.Event) => {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
      if (session.mode !== "payment") return;
      const user =
        (await userByCustomer(session.customer)) ?? (await userByReference(session.client_reference_id));
      if (!user) return;
      const lookupKey = session.metadata?.pack ?? null;
      const lineLookup = lookupKey ?? session.metadata?.lookupKey ?? null;
      let credits = creditsFromLookupKey(lineLookup);
      if (!credits && session.metadata?.credits) credits = Number(session.metadata.credits) || 0;
      if (!credits) return;
      await grantCredits(user.id, credits, {
        reason: "topup",
        refType: "stripe_event",
        refId: event.id,
        idempotencyKey: event.id,
        bucket: "bonus",
      });
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if ((invoice.amount_paid ?? 0) <= 0) return;
      const subscriptionId =
        invoice.parent?.subscription_details?.subscription ??
        ("subscription" in invoice ? (invoice.subscription as string | Stripe.Subscription | null) : null);
      const subId = typeof subscriptionId === "string" ? subscriptionId : subscriptionId?.id;
      if (!subId) return;
      const user = await userByCustomer(invoice.customer);
      if (!user) return;
      const { getStripe } = await import("./stripe");
      const subscription = await getStripe().subscriptions.retrieve(subId, { expand: ["items.data.price"] });
      await syncSubscription(subscription);
      const planId = planFromLookupKey(lookupKeyFromPrice(subscriptionPrice(subscription)));
      if (!planId) return;
      await refillFromSubscription(user.id, planId, event.id, periodEndFrom(subscription));
      return;
    }
    default:
      return;
  }
};
