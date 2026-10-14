// Auth.js endpoints: sign-in, OAuth callbacks, email verification, sign-out.
// Google's redirect URI is <origin>/api/auth/callback/google (see docs/SETUP.md).
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
