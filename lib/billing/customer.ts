import "server-only";
import { db } from "@/lib/db";
import { getStripe } from "./stripe";

export const ensureStripeCustomer = async (user: { id: string; email: string | null; name: string | null; stripeCustomerId: string | null }) => {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
};
