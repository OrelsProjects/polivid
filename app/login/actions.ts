"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { sendMagicLink } from "@/lib/auth/send-magic-link";
import { safeCallbackUrl } from "@/lib/session";

/** Starts Google OAuth, then returns to the page the user was trying to reach. */
export const signInWithGoogle = async (formData: FormData) => {
  await signIn("google", { redirectTo: safeCallbackUrl(formData.get("callbackUrl")) });
};

/** Emails a one-time sign-in link, then shows the check-email page. */
export const signInWithEmail = async (formData: FormData) => {
  const email = String(formData.get("email") ?? "").trim();
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));
  try {
    await sendMagicLink(email, callbackUrl);
  } catch (error) {
    console.error("[auth] email sign-in failed", error);
    const message = error instanceof Error ? error.message : "";
    const code = message.includes("not configured") || message.includes("AUTH_SECRET") ? "Configuration" : "EmailSignin";
    redirect(`/login?error=${code}`);
  }
  redirect("/login/check-email");
};

export const signOutAction = async () => {
  await signOut({ redirectTo: "/" });
};
