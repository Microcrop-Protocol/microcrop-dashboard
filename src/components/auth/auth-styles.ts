/**
 * THE AUTH SURFACE IS DELIBERATELY NOT THEMED.
 *
 * Every other screen in this dashboard draws from the HSL custom properties in index.css and
 * flips with the light/dark class. These two pages do not: they are committed to one dark
 * look, and the colours below are literal rather than `bg-background` / `text-foreground`.
 *
 * That is a decision, not an oversight. The sign-in screen is the first thing a partner sees
 * and the design is a specific near-black split screen with a blue primary action — the
 * product's emerald token set renders it as a different page entirely in light mode, and the
 * "left panel is darker than the right panel" relationship that carries the whole layout has
 * no equivalent in a light palette. Pre-auth there is also no user preference loaded yet, so
 * the theme at this point is an OS guess, not a choice the partner made.
 *
 * The consequence to respect: because these are literal colours, contrast is OUR problem
 * here — no upstream token set is checking it. Every pair below was measured. Two of them
 * forced a deliberate deviation from the supplied design, both recorded inline:
 *
 *   1. PRIMARY BLUE. The design calls for #2f6bff. White on #2f6bff measures 4.50:1, which
 *      lands a hair under the 4.5:1 AA floor for the 15px semibold button label (it is not
 *      large text — that needs 18.66px bold or 24px). The fill is therefore #2a62f0, which
 *      measures 5.12:1 and is visually indistinguishable. The ORIGINAL #2f6bff is kept for
 *      the glow and the focus ring, where it is decorative or need only clear 3:1.
 *
 *   2. CONTROL BORDER. A near-invisible border (#26272b) measures 1.26:1 against the panel,
 *      well under the 3:1 that WCAG 1.4.11 requires for the visual boundary of an input.
 *      Inputs and the provider button use #636670 (3.29:1) instead. This is the one place
 *      the page reads slightly more outlined than the reference image; an input the user
 *      cannot locate is not a design, so the contrast wins. Purely decorative lines — the
 *      "or" rule — keep the subtle value, because they bound nothing.
 *
 * Measured ratios (white #ffffff, panel #111113, input fill #191a1d):
 *   white/panel 18.86   label #c7c9d1/panel 11.41   muted #8a8d95/panel 5.68
 *   placeholder #7f828b/input 4.53   white/#2a62f0 5.12   white/#2456d8 6.18
 *   border #636670/panel 3.29   ring #2f6bff/panel 4.19
 * If you change a colour, re-measure it.
 */

/** Near-black of the left brand panel. */
export const PANEL_DARK = '#0a0a0c';
/** Slightly lighter near-black of the right form panel. */
export const PANEL_FORM = '#111113';
/** The design's blue. Decorative use only — glow and focus ring. See note 1 above. */
export const ACCENT_BLUE = '#2f6bff';
/** The blue actually painted behind white button text. See note 1 above. */
export const PRIMARY_BLUE = '#2a62f0';

/**
 * Focus ring shared by every interactive element on these pages.
 *
 * The offset colour is stated explicitly: `ring-offset-background` resolves to the themed
 * token, which on the light theme paints a near-white halo around the ring and makes it read
 * as a rendering artefact on a near-black panel.
 */
export const authFocusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111113]';

/**
 * Dark rounded input. Height and radius are fixed so inputs and buttons line up.
 *
 * The shared Input primitive carries themed border/background/ring utilities at the same
 * specificity as these, so the overrides only win because tailwind-merge (via `cn`) drops the
 * conflicting classes. Always compose this through `cn`, never by raw string concatenation,
 * or the themed values come back.
 */
export const authInputClass = [
  'h-11 w-full rounded-[10px] px-3.5',
  'border border-[#636670] bg-[#191a1d]',
  'text-[15px] text-white placeholder:text-[#7f828b]',
  'ring-offset-0',
  authFocusRing,
  'transition-colors duration-150 motion-reduce:transition-none',
  'hover:border-[#7c8089] focus-visible:border-[#2f6bff]',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

/** Field label above an input. */
export const authLabelClass = 'mb-2 block text-[13px] font-medium text-[#c7c9d1]';

/** Muted body/prose colour used for subtitles, the footer and helper text. */
export const authMutedTextClass = 'text-[#8a8d95]';

/** Full-width primary action. The glow is a sibling element — see AuthPrimaryButton. */
export const authPrimaryButtonClass = [
  'relative z-10 h-11 w-full rounded-[10px]',
  'bg-[#2a62f0] text-[15px] font-semibold text-white',
  'hover:bg-[#2456d8]',
  authFocusRing,
  'transition-colors duration-150 motion-reduce:transition-none',
  // The shared Button primitive animates a 1px lift and a 0.98 active scale. Both are
  // motion, and both must stop under prefers-reduced-motion.
  'motion-reduce:transform-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

/** Full-width dark secondary action (the provider button). */
export const authSecondaryButtonClass = [
  'h-11 w-full rounded-[10px]',
  'border border-[#636670] bg-[#191a1d] text-[15px] font-medium text-white',
  'hover:bg-[#1f2024]',
  authFocusRing,
  'transition-colors duration-150 motion-reduce:transition-none',
  'motion-reduce:transform-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
].join(' ');

/** Inline link rendered inside muted prose ("Don't have an account? Sign up"). */
export const authInlineLinkClass = [
  'rounded-sm font-semibold text-white underline-offset-4 hover:underline',
  authFocusRing,
].join(' ');

/** Small muted link, used in the footer and for "Forgot password?". */
export const authQuietLinkClass = [
  'rounded-sm text-[#8a8d95] underline-offset-4 hover:text-white hover:underline',
  'transition-colors duration-150 motion-reduce:transition-none',
  authFocusRing,
].join(' ');
