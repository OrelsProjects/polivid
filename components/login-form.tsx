import { signInWithGoogle } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

/** Auth.js error codes shown as ?error=... on /login. */
const AUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "That email already signed in another way. Use the same method as before.",
  AccessDenied: "Access was denied.",
  Configuration: "Sign-in isn't configured yet. Check the AUTH_* variables in .env.local.",
};

export const authErrorMessage = (error: string | null) =>
  error ? (AUTH_ERRORS[error] ?? "Sign-in failed. Try again.") : null;

export const LoginForm = ({ callbackUrl }: { callbackUrl: string }) => {
  return (
    <div className="flex flex-col gap-4">
      <form action={signInWithGoogle}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full rounded-xl bg-foreground text-background hover:bg-foreground/90"
          aria-label="Continue with Google"
        >
          <GoogleIcon />
          Continue with Google
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-2 text-xs text-muted-foreground">or</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Email</span>
        <input
          disabled
          placeholder="you@example.com"
          aria-label="Email"
          className="h-11 rounded-xl border border-border bg-muted/40 px-3 text-sm text-muted-foreground"
        />
        <Button type="button" disabled size="lg" className="h-11 w-full rounded-xl">
          Email me a sign-in link
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Email sign-in is coming next. The link will work once and expire in 24 hours. Use Google for now.
        </p>
      </div>
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
