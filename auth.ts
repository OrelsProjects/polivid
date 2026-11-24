import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";
import { applyViewAs } from "@/lib/auth/view-as-session";

const emailProviders = () => {
  const resendApiKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
  const emailFrom = process.env.AUTH_EMAIL_FROM;
  return resendApiKey && emailFrom ? [Resend({ apiKey: resendApiKey, from: emailFrom })] : [];
};

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Google reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET. AUTH_SECRET signs
 * cookies and tokens. Resend magic links use AUTH_RESEND_KEY (or
 * RESEND_API_KEY) and AUTH_EMAIL_FROM. Setup steps: docs/SETUP.md.
 *
 * Sessions are stored in Postgres ("database" strategy), so signing out or
 * deleting a session row takes effect immediately.
 *
 * Providers are built per request so adding AUTH_EMAIL_FROM / the Resend key
 * does not leave a stale "Google only" Auth.js instance in memory.
 */
const nextAuth = NextAuth(() => ({
  trustHost: true,
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    Google({
      // Google verifies emails, so the same address via magic link and Google
      // can share one account. See docs/SETUP.md.
      allowDangerousEmailAccountLinking: true,
    }),
    ...emailProviders(),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/login/check-email",
  },
}));

export const { handlers, signIn, signOut } = nextAuth;

/** Who is really signed in, ignoring "view as". Admin tools check this. */
export const realAuth = () => nextAuth.auth();

/**
 * The session the app acts on. While an admin views as another user (lib/auth/view-as.ts), it is that
 * user's, with `viewAs` naming the admin; otherwise it is the signed-in person's.
 */
export const auth = async () => applyViewAs(await nextAuth.auth());
