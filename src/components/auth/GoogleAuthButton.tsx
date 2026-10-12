/**
 * "Continue with Google".
 *
 * The backend does not implement Google OAuth (see lib/auth-providers.ts), so today this
 * always renders in its unavailable state. The two things that state must get right:
 *
 *   IT MUST NOT LOOK LIVE. Dimmed, `aria-disabled`, and a visible sentence underneath
 *   saying why — not a tooltip, which a touch user never sees.
 *
 *   IT MUST STILL BE REACHABLE BY KEYBOARD. It carries `aria-disabled="true"` rather than
 *   the `disabled` attribute. A `disabled` button is removed from the tab order, so a
 *   screen reader user tabbing the form would skip it and never learn the option exists or
 *   why it is off; they would be left guessing at a control their sighted colleague can
 *   see. `aria-disabled` keeps it focusable and announced as unavailable, and the handler
 *   below makes it genuinely inert. `aria-describedby` ties it to the explanation so the
 *   reason is read out on focus.
 *
 * It is a real <button> in both states.
 */
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { googleAuthState } from '@/lib/auth-providers';
import { authSecondaryButtonClass, authMutedTextClass } from './auth-styles';

/** The Google "G", inline so it needs no network request and no CSP allowance. */
function GoogleMark({ muted }: { muted: boolean }) {
  // Flattened to a single neutral fill when the control is unavailable: full-colour brand
  // marks read as "ready" no matter how dim the surrounding button is.
  if (muted) {
    return (
      <svg viewBox="0 0 18 18" className="h-[18px] w-[18px] text-muted-foreground" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Zm-8.64 9c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18.2Zm-5.03-7.28a5.41 5.41 0 0 1 0-3.44V5.15H.95a9 9 0 0 0 0 8.1l3.02-2.33ZM9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 5.15l3.02 2.33C4.68 5.36 6.66 3.78 9 3.78Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.95a9 9 0 0 0 0 8.1l3.02-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

interface GoogleAuthButtonProps {
  /** Verb shown in the label, e.g. "Continue with Google". */
  label?: string;
}

export function GoogleAuthButton({ label = 'Continue with Google' }: GoogleAuthButtonProps) {
  const state = googleAuthState();
  const explanationId = 'google-auth-unavailable';

  if (!state.enabled) {
    return (
      <div>
        <Button
          type="button"
          variant="outline"
          aria-disabled="true"
          aria-describedby={explanationId}
          // Inert by construction, not by convention: the click never reaches a handler that
          // could grow a side effect later.
          onClick={(event) => event.preventDefault()}
          className={cn(
            authSecondaryButtonClass,
            // Not `disabled:` utilities — the element is not disabled. The dimming and the
            // cursor have to be stated directly, and the hover tint has to be cancelled so
            // the control does not feel responsive.
            'cursor-not-allowed opacity-55 hover:bg-background',
          )}
        >
          <GoogleMark muted />
          {label}
        </Button>
        <p id={explanationId} className={`mt-2 text-center text-xs ${authMutedTextClass}`}>
          {state.reason}
        </p>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={startGoogleSignIn}
      className={cn(authSecondaryButtonClass)}
    >
      <GoogleMark muted={false} />
      {label}
    </Button>
  );
}

/**
 * Unreachable until the backend ships the route and the flag is flipped — kept beside the
 * button so the enabling change is one edit in one file rather than a hunt.
 */
function startGoogleSignIn() {
  const base = import.meta.env.VITE_API_URL ?? '';
  window.location.href = `${base}/api/auth/google`;
}
