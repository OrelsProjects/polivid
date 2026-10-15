export const PLAN_IDS = ["free", "starter", "growth", "ultra"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export const PAID_PLAN_IDS = ["starter", "growth", "ultra"] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const TOPUP_IDS = ["topup_1000", "topup_4000", "topup_10000"] as const;
export type TopupId = (typeof TOPUP_IDS)[number];

export const TRIAL_CREDITS = 100;
export const MIN_JOB_CREDITS = 5;
export const CREDITS_PER_USD = 100;

export interface Plan {
  id: PlanId;
  name: string;
  blurb: string;
  credits: number;
  monthlyCents: number;
  yearlyCents: number;
  popular?: boolean;
  features: readonly string[];
  monthlyLookupKey: string | null;
  yearlyLookupKey: string | null;
}

export interface TopupPack {
  id: TopupId;
  name: string;
  credits: number;
  cents: number;
  lookupKey: TopupId;
}

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    blurb: "Try PoliVid with no card.",
    credits: TRIAL_CREDITS,
    monthlyCents: 0,
    yearlyCents: 0,
    features: ["100 trial credits", "Create videos from text or links", "No credit card required"],
    monthlyLookupKey: null,
    yearlyLookupKey: null,
  },
  {
    id: "starter",
    name: "Starter",
    blurb: "For occasional, hands-on creation.",
    credits: 800,
    monthlyCents: 1900,
    yearlyCents: 19200,
    features: ["800 AI credits / month", "All creation tools", "Cancel anytime"],
    monthlyLookupKey: "starter_monthly",
    yearlyLookupKey: "starter_yearly",
  },
  {
    id: "growth",
    name: "Growth",
    blurb: "For regular creation.",
    credits: 2000,
    monthlyCents: 3900,
    yearlyCents: 38400,
    popular: true,
    features: ["2,000 AI credits / month", "All creation tools", "Cancel anytime"],
    monthlyLookupKey: "growth_monthly",
    yearlyLookupKey: "growth_yearly",
  },
  {
    id: "ultra",
    name: "Ultra",
    blurb: "For scaling brands, niches, or clients.",
    credits: 12_000,
    monthlyCents: 19900,
    yearlyCents: 199200,
    features: ["12,000 AI credits / month", "All creation tools", "Cancel anytime"],
    monthlyLookupKey: "ultra_monthly",
    yearlyLookupKey: "ultra_yearly",
  },
];

export const TOPUP_PACKS: readonly TopupPack[] = [
  { id: "topup_1000", name: "1,000 credits", credits: 1000, cents: 4900, lookupKey: "topup_1000" },
  { id: "topup_4000", name: "4,000 credits", credits: 4000, cents: 9900, lookupKey: "topup_4000" },
  { id: "topup_10000", name: "10,000 credits", credits: 10_000, cents: 19900, lookupKey: "topup_10000" },
];

export const MOTION_GRAPHICS_CREDITS: Record<"low" | "pro" | "ultra", number> = {
  low: 15,
  pro: 40,
  ultra: 80,
};

export const isPlanId = (value: string): value is PlanId => (PLAN_IDS as readonly string[]).includes(value);

export const isPaidPlanId = (value: string): value is PaidPlanId =>
  (PAID_PLAN_IDS as readonly string[]).includes(value);

export const isBillingInterval = (value: string): value is BillingInterval =>
  (BILLING_INTERVALS as readonly string[]).includes(value);

export const isTopupId = (value: string): value is TopupId => (TOPUP_IDS as readonly string[]).includes(value);

export const planById = (id: string) => PLANS.find((plan) => plan.id === id) ?? PLANS[0];

export const paidPlanById = (id: string) => PLANS.find((plan) => plan.id === id && plan.id !== "free") ?? null;

export const topupById = (id: string) => TOPUP_PACKS.find((pack) => pack.id === id) ?? null;

export const lookupKeyForPlan = (plan: PaidPlanId, interval: BillingInterval) => {
  const row = paidPlanById(plan);
  return interval === "year" ? row?.yearlyLookupKey : row?.monthlyLookupKey;
};

export const planFromLookupKey = (lookupKey: string | null | undefined): PaidPlanId | null => {
  if (!lookupKey) return null;
  for (const plan of PLANS) {
    if (plan.monthlyLookupKey === lookupKey || plan.yearlyLookupKey === lookupKey) {
      return plan.id === "free" ? null : plan.id;
    }
  }
  return null;
};

export const creditsFromLookupKey = (lookupKey: string | null | undefined) => {
  if (!lookupKey) return 0;
  const topup = topupById(lookupKey);
  if (topup) return topup.credits;
  const planId = planFromLookupKey(lookupKey);
  return planId ? planById(planId).credits : 0;
};

export const formatUsdFromCents = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

export const yearlyPerMonthCents = (yearlyCents: number) => Math.round(yearlyCents / 12);
