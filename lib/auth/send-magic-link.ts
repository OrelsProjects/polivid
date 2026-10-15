import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const emailSignInConfigured = () => {
  const apiKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  return Boolean(apiKey && from);
};

/** Same identifier rules Auth.js uses so the inbox link still matches the stored token. */
export const normalizeEmail = (email: string) => {
  const trimmedEmail = email.normalize("NFKC").toLowerCase().trim();
  if (trimmedEmail.includes('"')) {
    throw new Error("Invalid email address format.");
  }
  const [local, domain] = trimmedEmail.split("@");
  if (!local || !domain || trimmedEmail.split("@").length !== 2) {
    throw new Error("Invalid email address format.");
  }
  const host = domain.split(",")[0];
  if (!host) throw new Error("Invalid email address format.");
  return `${local}@${host}`;
};

const hashToken = async (token: string, secret: string) => {
  const data = new TextEncoder().encode(`${token}${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const appOrigin = async () => {
  const envUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? process.env.APP_PUBLIC_URL;
  if (envUrl) return new URL(envUrl).origin;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) throw new Error("Cannot determine the app URL for the sign-in link.");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
};

const sendResendEmail = async (to: string, url: string) => {
  const apiKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Email sign-in is not configured.");
  }

  const host = new URL(url).host;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "polivid-auth",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Sign in to ${host}`,
      html: magicLinkHtml(url, host),
      text: `Sign in to ${host}\n${url}\n\n`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend rejected the sign-in email (${response.status}): ${detail}`);
  }
};

const magicLinkHtml = (url: string, host: string) => {
  const escapedHost = host.replace(/\./g, "&#8203;.");
  return `
<body style="background:#f9f9f9;">
  <table width="100%" border="0" cellspacing="20" cellpadding="0"
    style="background:#fff;max-width:600px;margin:auto;border-radius:10px;">
    <tr>
      <td align="center" style="padding:10px 0;font-size:22px;font-family:Helvetica,Arial,sans-serif;color:#444;">
        Sign in to <strong>${escapedHost}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 0;">
        <a href="${url}" target="_blank"
          style="font-size:18px;font-family:Helvetica,Arial,sans-serif;color:#fff;text-decoration:none;border-radius:5px;padding:10px 20px;border:1px solid #346df1;display:inline-block;font-weight:bold;background:#346df1;">
          Sign in
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0 0 10px;font-size:16px;line-height:22px;font-family:Helvetica,Arial,sans-serif;color:#444;">
        If you did not request this email you can safely ignore it.
      </td>
    </tr>
  </table>
</body>`;
};

/**
 * Saves the Auth.js verification token first, then emails the magic link.
 * Auth.js still consumes the link at /api/auth/callback/resend.
 */
export const sendMagicLink = async (rawEmail: string, callbackUrl: string) => {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  if (!emailSignInConfigured()) throw new Error("Email sign-in is not configured.");

  const email = normalizeEmail(rawEmail);
  const token = randomToken();
  const expires = new Date(Date.now() + TOKEN_MAX_AGE_MS);
  const origin = await appOrigin();
  const url = `${origin}/api/auth/callback/resend?${new URLSearchParams({
    callbackUrl,
    token,
    email,
  })}`;

  await db.verificationToken.create({
    data: {
      identifier: email,
      token: await hashToken(token, secret),
      expires,
    },
  });

  try {
    await sendResendEmail(email, url);
  } catch (error) {
    await db.verificationToken.deleteMany({
      where: { identifier: email, expires },
    });
    throw error;
  }
};
