import { signInWithEmail, signInWithGoogle } from "@/app/login/actions";
import { SubmitButton } from "@/components/submit-button";

/** Auth.js error codes shown as ?error=... on /login. */
const AUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "That email already signed in another way. Use the same method as before.",
  AccessDenied: "Access was denied.",
  Configuration: "Email sign-in isn't available right now. Try Google, or try again in a moment.",
  EmailSignin: "We couldn't send the sign-in link. Check the address and try again.",
  Verification: "That sign-in link is invalid or has expired. Request a new one.",
};

export const authErrorMessage = (error: string | null) =>
  error ? (AUTH_ERRORS[error] ?? "Sign-in failed. Try again.") : null;

export const LoginForm = ({ callbackUrl }: { callbackUrl: string }) => {
  return (
    <div className="flex flex-col gap-4">
      <form action={signInWithGoogle}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <SubmitButton
          size="lg"
          pendingLabel="Opening Google…"
          className="h-12 w-full rounded-xl bg-foreground text-background hover:bg-foreground/90"
        >
          <GoogleIcon />
          Continue with Google
        </SubmitButton>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-2 text-xs text-muted-foreground">or</span>
        </div>
      </div>

      <form action={signInWithEmail} className="flex flex-col gap-2">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-describedby="email-signin-hint"
          className="h-11 rounded-xl border border-border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
        />
        <SubmitButton size="lg" pendingLabel="Sending link…" className="h-11 w-full rounded-xl">
          Email me a sign-in link
        </SubmitButton>
        <p id="email-signin-hint" className="text-xs leading-relaxed text-muted-foreground">
          The link will work once and expire in 24 hours.
        </p>
      </form>
    </div>
  );
};

const GoogleIcon = () => {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-4">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
};
