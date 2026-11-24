import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * "View as": an admin sees the app, and acts, as another user. The choice lives in a signed cookie
 * that names both the admin and the user, so it can't be forged, moved to another account, or outlive
 * its expiry. Admins are listed by email in ADMIN_EMAILS, which is checked on every request.
 */

export const VIEW_AS_COOKIE = "polivid-view-as";
/** A view-as session ends on its own after this long. */
export const VIEW_AS_TTL_MS = 12 * 60 * 60 * 1000;

const secret = () => {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET is not set.");
  return value;
};

const sign = (body: string) => createHmac("sha256", secret()).update(`view-as:${body}`).digest("base64url");

/** Emails allowed to view as other users, from ADMIN_EMAILS (comma separated). */
export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const isAdminEmail = (email: string | null | undefined) => Boolean(email) && adminEmails().includes(email!.toLowerCase());

/** The cookie value that lets `adminId` view as `userId` until it expires. */
export const signViewAs = (adminId: string, userId: string, now = Date.now()) => {
  const body = Buffer.from(JSON.stringify({ a: adminId, u: userId, e: now + VIEW_AS_TTL_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
};

/** The user `adminId` is viewing as, or null when the value is missing, forged, someone else's, or expired. */
export const readViewAs = (value: string | undefined, adminId: string, now = Date.now()) => {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(body));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { a?: unknown; u?: unknown; e?: unknown };
    if (payload.a !== adminId || typeof payload.u !== "string" || typeof payload.e !== "number" || payload.e < now) return null;
    return payload.u;
  } catch {
    return null;
  }
};
