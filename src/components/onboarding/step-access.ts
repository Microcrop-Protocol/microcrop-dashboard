import { useCallback, useRef, useState } from 'react';

/**
 * WHAT AN ONBOARDING STEP'S ACTION STILL NEEDS.
 *
 * Every step of both wizards can be opened at any time: the field agent moves freely through
 * the stepper and fills things in in whatever order the visit allows. The prerequisites are
 * enforced at SUBMIT instead. When the agent presses a step's primary action (Register, Verify,
 * Create plot, Get quote, Purchase, Pay…), the wizard asks the functions below what is still
 * missing for that action, and if anything is, it makes no request and lists every gap, each
 * one a link to the step that fills it.
 *
 * This file is the single source of truth for those prerequisites. The same lists drive the
 * inline notice on a step that cannot show anything meaningful without earlier data (the
 * boundary walk needs a saved plot to attach to, payment needs a policy).
 *
 * Two requirements are stricter than the data alone, and stay requirements: identity
 * verification before the plot or herd is created, and the boundary walk before a crop quote.
 * The backend's purchase refuses a farmer whose KYC is not APPROVED, so letting the plot or
 * herd through unverified would only move the refusal to the end of the visit.
 */

interface WithKyc {
  kycStatus?: string | null;
}

/** One unmet prerequisite: what to do, and the step where it is done. */
export interface MissingPrerequisite<Id extends string> {
  step: Id;
  label: string;
}

// ── Crop ────────────────────────────────────────────────────

export interface FieldStepState {
  farmer: WithKyc | null;
  plot: unknown;
  boundaryResult: unknown;
  /** The quote while it still prices the coverage form (null once the form moves on). */
  quote: unknown;
  /** A quote was calculated, but the coverage form has changed since. */
  staleQuote?: boolean;
  policy: unknown;
}

export type FieldStepId =
  | 'register' | 'consent' | 'kyc' | 'plot' | 'walk' | 'review' | 'quote' | 'purchase' | 'payment';

/**
 * How many links of the prerequisite chain each crop step's action needs. The chain is
 * farmer → verified → plot → boundary → quote → policy, and every action needs a prefix of it.
 */
const FIELD_NEEDS: Record<FieldStepId, number> = {
  register: 0,
  consent: 1,
  kyc: 1,
  plot: 2,
  walk: 3,
  review: 4,
  quote: 4,
  purchase: 5,
  payment: 6,
};

/**
 * Everything the action on crop step `id` still needs, earliest first, or an empty list when
 * it may be submitted. Lists every gap, not just the first, so one message can name them all.
 */
export function fieldActionMissing(id: FieldStepId, s: FieldStepState): MissingPrerequisite<FieldStepId>[] {
  const chain: (MissingPrerequisite<FieldStepId> | null)[] = [
    s.farmer ? null : { step: 'register', label: 'Register the farmer' },
    s.farmer?.kycStatus === 'APPROVED' ? null : { step: 'kyc', label: "Verify the farmer's identity" },
    s.plot ? null : { step: 'plot', label: 'Create the plot' },
    s.boundaryResult ? null : { step: 'walk', label: 'Walk the plot boundary' },
    s.quote || s.policy
      ? null
      : {
        step: 'quote',
        label: s.staleQuote ? 'Get a new quote — the coverage changed since the last one' : 'Get a premium quote',
      },
    s.policy ? null : { step: 'purchase', label: 'Purchase the policy' },
  ];
  return chain.slice(0, FIELD_NEEDS[id]).filter((m): m is MissingPrerequisite<FieldStepId> => m != null);
}

/**
 * Whether crop step `id` is done — its record really exists. Drives the stepper's ticks.
 * Consent and review save nothing of their own, so they count once the agent has been there
 * with what they show in place.
 */
export function fieldStepDone(
  id: FieldStepId,
  s: FieldStepState & { paymentCompleted?: boolean },
  visited: (id: FieldStepId) => boolean,
): boolean {
  switch (id) {
    case 'register': return Boolean(s.farmer);
    case 'consent': return Boolean(s.farmer) && visited('consent');
    case 'kyc': return s.farmer?.kycStatus === 'APPROVED';
    case 'plot': return Boolean(s.plot);
    case 'walk': return Boolean(s.boundaryResult);
    case 'review': return Boolean(s.boundaryResult) && visited('review');
    case 'quote': return Boolean(s.quote || s.policy);
    case 'purchase': return Boolean(s.policy);
    case 'payment': return Boolean(s.paymentCompleted);
  }
}

// ── Livestock ───────────────────────────────────────────────

export interface LivestockStepState {
  farmer: WithKyc | null;
  herd: unknown;
  quote: unknown;
  staleQuote?: boolean;
  policy: unknown;
}

export type LivestockStepId = 'register' | 'consent' | 'kyc' | 'herd' | 'quote' | 'purchase' | 'payment';

/** The livestock chain: pastoralist → verified → herd → quote → policy. */
const LIVESTOCK_NEEDS: Record<LivestockStepId, number> = {
  register: 0,
  consent: 1,
  kyc: 1,
  herd: 2,
  quote: 3,
  purchase: 4,
  payment: 5,
};

export function livestockActionMissing(
  id: LivestockStepId,
  s: LivestockStepState,
): MissingPrerequisite<LivestockStepId>[] {
  const chain: (MissingPrerequisite<LivestockStepId> | null)[] = [
    s.farmer ? null : { step: 'register', label: 'Register the pastoralist' },
    s.farmer?.kycStatus === 'APPROVED' ? null : { step: 'kyc', label: "Verify the pastoralist's identity" },
    s.herd ? null : { step: 'herd', label: 'Register the herd' },
    s.quote || s.policy
      ? null
      : {
        step: 'quote',
        label: s.staleQuote ? 'Get a new quote — the season or peril changed since the last one' : 'Calculate the premium',
      },
    s.policy ? null : { step: 'purchase', label: 'Create the policy' },
  ];
  return chain.slice(0, LIVESTOCK_NEEDS[id]).filter((m): m is MissingPrerequisite<LivestockStepId> => m != null);
}

export function livestockStepDone(
  id: LivestockStepId,
  s: LivestockStepState & { paymentCompleted?: boolean },
  visited: (id: LivestockStepId) => boolean,
): boolean {
  switch (id) {
    case 'register': return Boolean(s.farmer);
    case 'consent': return Boolean(s.farmer) && visited('consent');
    case 'kyc': return s.farmer?.kycStatus === 'APPROVED';
    case 'herd': return Boolean(s.herd);
    case 'quote': return Boolean(s.quote || s.policy);
    case 'purchase': return Boolean(s.policy);
    case 'payment': return Boolean(s.paymentCompleted);
  }
}

// ── Shared ──────────────────────────────────────────────────

/**
 * True when the form values a quote was calculated from still match the form. A quote is only
 * good for the inputs it priced: once the agent edits the coverage form, the wizard treats the
 * quote as gone, and Purchase asks for a new one. Values are compared as strings because a
 * number input can hand back "10000" for the 10000 that was quoted.
 */
export function quoteInputsMatch<T extends object>(current: Partial<T>, quoted: T | null): boolean {
  if (!quoted) return false;
  return (Object.keys(quoted) as (keyof T)[]).every(
    (key) => String(current[key] ?? '') === String(quoted[key] ?? ''),
  );
}

/**
 * The only time a step cannot be opened: while a request is in flight. Its success handler
 * moves the wizard on its own, so the agent waits for it rather than racing it.
 */
export const BUSY_REASON = 'Wait for the current request to finish';

/**
 * The current step, the steps ever visited, and whether the current step's submit was refused
 * for missing prerequisites. Moving to any step clears the refusal: the message belongs to the
 * step it was raised on, and it is raised again if the agent comes back and presses again.
 */
export function useStepProgress(initial = 0) {
  const [state, setState] = useState<{ current: number; visited: number[]; blockedAt: number | null }>(
    { current: initial, visited: [initial], blockedAt: null },
  );
  const setCurrentStep = useCallback((index: number) => {
    setState((prev) => ({
      current: index,
      visited: prev.visited.includes(index) ? prev.visited : [...prev.visited, index],
      blockedAt: null,
    }));
  }, []);
  const showSubmitBlocked = useCallback(() => {
    setState((prev) => ({ ...prev, blockedAt: prev.current }));
  }, []);
  const clearSubmitBlocked = useCallback(() => {
    setState((prev) => (prev.blockedAt == null ? prev : { ...prev, blockedAt: null }));
  }, []);
  return {
    currentStep: state.current,
    visitedSteps: state.visited,
    submitBlocked: state.blockedAt === state.current,
    setCurrentStep,
    showSubmitBlocked,
    clearSubmitBlocked,
  };
}

/**
 * One request at a time, from the click that starts it. A mutation's `isPending` disables its
 * button only after the next render, so two taps in the same frame (or a form whose async
 * validation resolves twice) could each start a request — a second farmer, plot or policy.
 * `run` refuses while a request it started is still open; each mutation calls `release` when
 * it settles.
 */
export function useSingleFlight() {
  const open = useRef(false);
  const run = useCallback((start: () => void) => {
    if (open.current) return;
    open.current = true;
    start();
  }, []);
  const release = useCallback(() => {
    open.current = false;
  }, []);
  return { run, release };
}
