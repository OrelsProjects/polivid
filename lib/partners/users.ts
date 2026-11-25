import "server-only";
import { db } from "@/lib/db";

/** A partner's own user ids: letters, digits, and a few separators, so they are safe in an email-shaped key. */
export const EXTERNAL_USER_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * The address on an account made for a partner's user. The .invalid domain can never receive mail,
 * and no sign-in account is linked, so nobody can sign in to it here.
 */
export const partnerUserEmail = (partnerId: string, externalUserId: string) =>
  `${partnerId}+${externalUserId.toLowerCase()}@partners.invalid`;

/**
 * Our account for one of the partner's users, made the first time the partner acts for them.
 * A partner only ever reaches accounts it made, so its secret can't touch anyone else's.
 */
export const ensurePartnerUser = async (partnerId: string, externalUserId: string) => {
  if (!EXTERNAL_USER_ID.test(externalUserId)) throw new Error("That user id isn't valid.");
  const linked = await db.partnerUser.findUnique({
    where: { partnerId_externalUserId: { partnerId, externalUserId } },
    select: { userId: true },
  });
  if (linked) return linked.userId;
  try {
    const user = await db.user.create({
      data: {
        email: partnerUserEmail(partnerId, externalUserId),
        partnerId,
        // Partner users have no trial: their videos are paid for by the allowance the partner sets.
        bonusCredits: 0,
        partnerLink: { create: { partnerId, externalUserId } },
      },
      select: { id: true },
    });
    return user.id;
  } catch (error) {
    // Two first requests at once: the other one made the account.
    const raced = await db.partnerUser.findUnique({
      where: { partnerId_externalUserId: { partnerId, externalUserId } },
      select: { userId: true },
    });
    if (raced) return raced.userId;
    throw error;
  }
};
