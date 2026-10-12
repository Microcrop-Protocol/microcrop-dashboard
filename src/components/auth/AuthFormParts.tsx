/**
 * The small repeated pieces of the auth form: the "or" rule, the glowing primary action,
 * a labelled field, and the "Don't have an account?" line.
 *
 * These exist so sign-in and sign-up cannot drift apart, and so the accessibility wiring —
 * label/input association, aria-invalid, aria-describedby, role="alert" — is done once and
 * is impossible to forget at a call site.
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  authInputClass,
  authLabelClass,
  authMutedTextClass,
  authPrimaryButtonClass,
} from './auth-styles';

/** Horizontal rule with a centred lowercase "or". */
export function OrDivider() {
  return (
    // The rules are decorative; the word is read. A <hr> either side would announce two
    // separators around a stray "or", which is noise, so the lines are styled divs.
    <div className="flex items-center gap-4" role="presentation">
      <div className="h-px flex-1 bg-border" />
      <span className={`text-xs ${authMutedTextClass}`}>or</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  /** Validation message. Presence switches the field into its invalid state. */
  error?: string;
  /** Optional control rendered to the right of the label, e.g. "Forgot password?". */
  labelAction?: ReactNode;
  /** Static helper text shown under the input. */
  hint?: string;
}

/**
 * A labelled input.
 *
 * The <label> is bound with htmlFor/id rather than by wrapping, so the hit area is the text
 * only and the association survives the input being swapped for a different element.
 */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { id, label, error, labelAction, hint, className, ...inputProps },
  ref,
) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  // Order matters: the error is read before the hint, because it is the actionable part.
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={authLabelClass}>
          {label}
        </label>
        {labelAction}
      </div>
      <Input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(authInputClass, error && 'border-destructive focus-visible:border-destructive', className)}
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className={`mt-1.5 text-xs ${authMutedTextClass}`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        // role="alert" so a message that appears after submit is announced without the user
        // having to go looking for it.
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
});

interface AuthPrimaryButtonProps {
  children: ReactNode;
  loading?: boolean;
  type?: 'submit' | 'button';
  onClick?: () => void;
}

/** Full-width primary action with the soft blue glow beneath it. */
export function AuthPrimaryButton({
  children,
  loading = false,
  type = 'submit',
  onClick,
}: AuthPrimaryButtonProps) {
  return (
    <div className="relative">
      {/*
        The glow. A blurred brand-colour bar sitting behind and below the button — decorative, so
        aria-hidden, and pointer-events-none so it never eats the click.

        It is STATIC: no animation, no transition. prefers-reduced-motion is about movement,
        and a motionless blur does not trigger vestibular symptoms, so switching it off
        would cost the design for nothing. Everything here that does move — the button's
        colour transition, lift and active scale — is cancelled under the preference by
        authPrimaryButtonClass, and the spinner below is likewise handled.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 bottom-0 top-2 rounded-[10px] bg-primary opacity-30 blur-lg"
      />
      <Button
        type={type}
        onClick={onClick}
        disabled={loading}
        className={cn(authPrimaryButtonClass)}
      >
        {loading ? (
          // The spin is motion. Under prefers-reduced-motion Tailwind's motion-reduce
          // variant stops it, which would leave a frozen partial circle meaning nothing —
          // so the accessible name carries the state regardless of whether it turns.
          <Loader2
            className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        <span>{children}</span>
        {loading ? <span className="sr-only">, please wait</span> : null}
      </Button>
    </div>
  );
}

/** "Don't have an account? Sign up" — centred muted text with a white semibold link. */
export function AuthAltAction({ children }: { children: ReactNode }) {
  return <p className={`mt-7 text-center text-sm ${authMutedTextClass}`}>{children}</p>;
}
