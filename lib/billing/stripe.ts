import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export const hasStripeKey = () => Boolean(process.env.STRIPE_SECRET_KEY);

export const getStripe = () => {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!client) client = new Stripe(apiKey);
  return client;
};

export const appOrigin = () => process.env.APP_PUBLIC_URL?.replace(/\/$/, "") || "http://localhost:3100";

export const checkoutSuffix = () => Math.random().toString(36).slice(2, 10);

export const priceByLookupKey = async (lookupKey: string) => {
  const stripe = getStripe();
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return prices.data[0] ?? null;
};
