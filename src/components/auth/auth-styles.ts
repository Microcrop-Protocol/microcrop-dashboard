/**
 * THE AUTH SURFACE USES THE APP'S THEME.
 *
 * Sign-in and sign-up were briefly committed to a literal near-black palette that no other
 * screen used, so a partner's first impression was a dark page in front of a light emerald
 * product. Everything here now draws from the HSL custom properties in index.css, like the
 * rest of the dashboard, and the layout (split screen, brand panel, form column) is unchanged.
 *
 * One deliberate deviation from the shared tokens: INPUT AND PROVIDER-BUTTON BORDERS use
 * `border-muted-foreground/70` rather than `border-input`. `--input` measures about 1.3:1
 * against the page, under the 3:1 that WCAG 1.4.11 requires for an input's visible boundary;
 * the stronger border clears it. The "or" rule is decorative and keeps `bg-border`.
 *
 * Known, app-wide, NOT fixed here: white on `--primary` (the emerald button) measures about
 * 2.6:1, and `--destructive` text on white about 3.8:1, both under AA for 15px/12px text.
 * Every primary button and error message in the dashboard shares those tokens, so the fix
 * belongs in index.css, not in a one-page override.
 */

/** Focus ring shared by every interactive element on these pages. */
export const authFocusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Rounded input. Height and radius are fixed so inputs and buttons line up.
 *
 * The shared Input primitive carries themed border/background/ring utilities at the same
 * specificity as these, so the overrides only win because tailwind-merge (via `cn`) drops the
 * conflicting classes. Always compose this through `cn`, never by raw string concatenation,
 * or the themed values come back.
 */
export const authInputClass = [
  'h-11 w-full rounded-[10px] px-3.5',
  'border border-muted-foreground/70 bg-background',
  'text-[15px] text-foreground placeholder:text-muted-foreground',
  'ring-offset-0',
  authFocusRing,
  'transition-colors duration-150 motion-reduce:transition-none',
  'hover:border-foreground/60 focus-visible:border-primary',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

/** Field label above an input. */
export const authLabelClass = 'mb-2 block text-[13px] font-medium text-foreground';

/** Muted body/prose colour used for subtitles, the footer and helper text. */
export const authMutedTextClass = 'text-muted-foreground';

/** Full-width primary action. The glow is a sibling element — see AuthPrimaryButton. */
export const authPrimaryButtonClass = [
  'relative z-10 h-11 w-full rounded-[10px]',
  'bg-primary text-[15px] font-semibold text-primary-foreground',
  'hover:bg-primary/90',
  authFocusRing,
  'transition-colors duration-150 motion-reduce:transition-none',
  // The shared Button primitive animates a 1px lift and a 0.98 active scale. Both are
  // motion, and both must stop under prefers-reduced-motion.
  'motion-reduce:transform-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

/** Full-width secondary action (the provider button). */
export const authSecondaryButtonClass = [
  'h-11 w-full rounded-[10px]',
  'border border-muted-foreground/70 bg-background text-[15px] font-medium text-foreground',
  'hover:bg-muted',
  authFocusRing,
  'transition-colors duration-150 motion-reduce:transition-none',
  'motion-reduce:transform-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
].join(' ');

/** Inline link rendered inside muted prose ("Don't have an account? Sign up"). */
export const authInlineLinkClass = [
  'rounded-sm font-semibold text-primary underline-offset-4 hover:underline',
  authFocusRing,
].join(' ');

/** Small muted link, used in the footer and for "Forgot password?". */
export const authQuietLinkClass = [
  'rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline',
  'transition-colors duration-150 motion-reduce:transition-none',
  authFocusRing,
].join(' ');
