import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { InsufficientCreditsError } from "./errors";
import { isPaidSubscriptionStatus, nextRefillAt, splitRefund, splitSpend } from "./math";
import { planById, type PlanId } from "./plans";

type Tx = Prisma.TransactionClient;

export interface CreditBalance {
  plan: PlanId;
  planCredits: number;
  bonusCredits: number;
  total: number;
  creditsRefillAt: Date | null;
  subscriptionStatus: string | null;
  billingInterval: string | null;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
}

export interface CreditMove {
  reason: string;
  refType?: string;
  refId?: string;
  idempotencyKey: string;
}

const withTx = async <T>(tx: Tx | undefined, run: (client: Tx) => Promise<T>) => {
  if (tx) return run(tx);
  return db.$transaction((client) => run(client));
};

const toBalance = (user: {
  plan: string;
  planCredits: number;
  bonusCredits: number;
  creditsRefillAt: Date | null;
  subscriptionStatus: string | null;
  billingInterval: string | null;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
}): CreditBalance => ({
  plan: planById(user.plan).id,
  planCredits: user.planCredits,
  bonusCredits: user.bonusCredits,
  total: user.planCredits + user.bonusCredits,
  creditsRefillAt: user.creditsRefillAt,
  subscriptionStatus: user.subscriptionStatus,
  billingInterval: user.billingInterval,
  currentPeriodEnd: user.currentPeriodEnd,
  stripeCustomerId: user.stripeCustomerId,
  subscriptionId: user.subscriptionId,
});

const applyRefill = async (tx: Tx, userId: string, now = new Date()) => {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found.");
  const plan = planById(user.plan);
  if (plan.id === "free" || !isPaidSubscriptionStatus(user.subscriptionStatus)) return user;
  if (!user.creditsRefillAt || user.creditsRefillAt.getTime() > now.getTime()) return user;
  const next = nextRefillAt(user.creditsRefillAt, now);
  const idempotencyKey = `refill:${userId}:${user.creditsRefillAt.toISOString()}`;
  const existing = await tx.creditLedger.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return tx.user.findUniqueOrThrow({ where: { id: userId } });
  }
  const delta = plan.credits - user.planCredits;
  await tx.user.update({
    where: { id: userId },
    data: { planCredits: plan.credits, creditsRefillAt: next },
  });
  if (delta !== 0) {
    await tx.creditLedger.create({
      data: {
        userId,
        delta,
        bucket: "plan",
        reason: "refill",
        idempotencyKey,
      },
    });
  }
  return tx.user.findUniqueOrThrow({ where: { id: userId } });
};

export const getBalance = async (userId: string): Promise<CreditBalance> => {
  const user = await withTx(undefined, async (tx) => applyRefill(tx, userId));
  return toBalance(user);
};

const alreadyMoved = async (tx: Tx, idempotencyKey: string) =>
  tx.creditLedger.findFirst({
    where: { OR: [{ idempotencyKey: `${idempotencyKey}:plan` }, { idempotencyKey: `${idempotencyKey}:bonus` }] },
  });

export const reserveCredits = async (userId: string, amount: number, move: CreditMove, tx?: Tx) => {
  if (amount <= 0) return { fromPlan: 0, fromBonus: 0 };
  return withTx(tx, async (client) => {
    if (await alreadyMoved(client, move.idempotencyKey)) {
      const rows = await client.creditLedger.findMany({
        where: { idempotencyKey: { startsWith: `${move.idempotencyKey}:` } },
      });
      return {
        fromPlan: Math.abs(rows.find((row) => row.bucket === "plan")?.delta ?? 0),
        fromBonus: Math.abs(rows.find((row) => row.bucket === "bonus")?.delta ?? 0),
      };
    }
    const user = await applyRefill(client, userId);
    const split = splitSpend(user.planCredits, user.bonusCredits, amount);
    if (!split) throw new InsufficientCreditsError(amount, user.planCredits + user.bonusCredits);
    const updated = await client.user.updateMany({
      where: { id: userId, planCredits: user.planCredits, bonusCredits: user.bonusCredits },
      data: {
        planCredits: { decrement: split.fromPlan },
        bonusCredits: { decrement: split.fromBonus },
      },
    });
    if (updated.count !== 1) {
      throw new Error("Your credit balance changed. Try again.");
    }
    const rows = [
      split.fromPlan > 0
        ? {
            userId,
            delta: -split.fromPlan,
            bucket: "plan",
            reason: move.reason,
            refType: move.refType,
            refId: move.refId,
            idempotencyKey: `${move.idempotencyKey}:plan`,
          }
        : null,
      split.fromBonus > 0
        ? {
            userId,
            delta: -split.fromBonus,
            bucket: "bonus",
            reason: move.reason,
            refType: move.refType,
            refId: move.refId,
            idempotencyKey: `${move.idempotencyKey}:bonus`,
          }
        : null,
    ].filter(Boolean);
    if (rows.length > 0) await client.creditLedger.createMany({ data: rows as Prisma.CreditLedgerCreateManyInput[] });
    return split;
  });
};

export const refundCredits = async (
  userId: string,
  amount: number,
  move: CreditMove & { holdKey: string },
  tx?: Tx,
) => {
  if (amount <= 0) return { fromPlan: 0, fromBonus: 0 };
  return withTx(tx, async (client) => {
    if (await alreadyMoved(client, move.idempotencyKey)) {
      const rows = await client.creditLedger.findMany({
        where: { idempotencyKey: { startsWith: `${move.idempotencyKey}:` } },
      });
      return {
        fromPlan: rows.find((row) => row.bucket === "plan")?.delta ?? 0,
        fromBonus: rows.find((row) => row.bucket === "bonus")?.delta ?? 0,
      };
    }
    const holds = await client.creditLedger.findMany({
      where: { idempotencyKey: { startsWith: `${move.holdKey}:` } },
    });
    const fromPlanHeld = Math.abs(holds.find((row) => row.bucket === "plan")?.delta ?? 0);
    const fromBonusHeld = Math.abs(holds.find((row) => row.bucket === "bonus")?.delta ?? 0);
    const split = splitRefund(fromPlanHeld, fromBonusHeld, amount);
    if (split.fromPlan === 0 && split.fromBonus === 0) return split;
    const user = await client.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found.");
    const updated = await client.user.updateMany({
      where: { id: userId, planCredits: user.planCredits, bonusCredits: user.bonusCredits },
      data: {
        planCredits: { increment: split.fromPlan },
        bonusCredits: { increment: split.fromBonus },
      },
    });
    if (updated.count !== 1) {
      throw new Error("Your credit balance changed. Try again.");
    }
    const rows = [
      split.fromPlan > 0
        ? {
            userId,
            delta: split.fromPlan,
            bucket: "plan",
            reason: move.reason,
            refType: move.refType,
            refId: move.refId,
            idempotencyKey: `${move.idempotencyKey}:plan`,
          }
        : null,
      split.fromBonus > 0
        ? {
            userId,
            delta: split.fromBonus,
            bucket: "bonus",
            reason: move.reason,
            refType: move.refType,
            refId: move.refId,
            idempotencyKey: `${move.idempotencyKey}:bonus`,
          }
        : null,
    ].filter(Boolean);
    if (rows.length > 0) await client.creditLedger.createMany({ data: rows as Prisma.CreditLedgerCreateManyInput[] });
    return split;
  });
};

export const grantCredits = async (
  userId: string,
  amount: number,
  move: CreditMove & { bucket?: "plan" | "bonus" },
  extra: Prisma.UserUpdateInput = {},
  tx?: Tx,
) => {
  if (amount <= 0 && Object.keys(extra).length === 0) return;
  const bucket = move.bucket ?? "bonus";
  return withTx(tx, async (client) => {
    const existing = await client.creditLedger.findUnique({ where: { idempotencyKey: move.idempotencyKey } });
    if (existing) return;
    await client.user.update({
      where: { id: userId },
      data: {
        ...extra,
        ...(amount > 0
          ? bucket === "plan"
            ? { planCredits: { increment: amount } }
            : { bonusCredits: { increment: amount } }
          : {}),
      },
    });
    if (amount > 0) {
      await client.creditLedger.create({
        data: {
          userId,
          delta: amount,
          bucket,
          reason: move.reason,
          refType: move.refType,
          refId: move.refId,
          idempotencyKey: move.idempotencyKey,
        },
      });
    }
  });
};

export const setPlanCredits = async (
  userId: string,
  amount: number,
  move: CreditMove,
  extra: Prisma.UserUpdateInput = {},
  tx?: Tx,
) => {
  return withTx(tx, async (client) => {
    const existing = await client.creditLedger.findUnique({ where: { idempotencyKey: move.idempotencyKey } });
    if (existing) return;
    const user = await client.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found.");
    const delta = amount - user.planCredits;
    await client.user.update({
      where: { id: userId },
      data: { ...extra, planCredits: amount },
    });
    if (delta !== 0) {
      await client.creditLedger.create({
        data: {
          userId,
          delta,
          bucket: "plan",
          reason: move.reason,
          refType: move.refType,
          refId: move.refId,
          idempotencyKey: move.idempotencyKey,
        },
      });
    }
  });
};

export const requireCredits = async (userId: string, amount = 1) => {
  const balance = await getBalance(userId);
  if (balance.total < amount) throw new InsufficientCreditsError(amount, balance.total);
  return balance;
};
