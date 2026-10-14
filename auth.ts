import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Google reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET. AUTH_SECRET signs
 * cookies and tokens. Email magic links are off until a verified sender is
 * ready. Setup steps: docs/SETUP.md.
 *
 * Sessions are stored in Postgres ("database" strategy), so signing out or
 * deleting a session row takes effect immediately.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [Google({})],
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
