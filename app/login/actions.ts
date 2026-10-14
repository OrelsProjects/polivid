"use server";

import { signIn, signOut } from "@/auth";
import { safeCallbackUrl } from "@/lib/session";

/** Starts Google OAuth, then returns to the page the user was trying to reach. */
export const signInWithGoogle = async (formData: FormData) => {
  await signIn("google", { redirectTo: safeCallbackUrl(formData.get("callbackUrl")) });
};

export const signOutAction = async () => {
  await signOut({ redirectTo: "/" });
};
