import { auth } from "@/auth";
import { getBalance } from "@/lib/billing/credits";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const balance = await getBalance(userId);
  return Response.json({
    plan: balance.plan,
    planCredits: balance.planCredits,
    bonusCredits: balance.bonusCredits,
    total: balance.total,
    creditsRefillAt: balance.creditsRefillAt?.toISOString() ?? null,
  });
}
