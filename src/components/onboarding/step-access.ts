import { useCallback, useState } from 'react';

/**
 * WHICH ONBOARDING STEPS THE STEPPER MAY JUMP TO.
 *
 * The step circles are navigable, but only onto a step whose renderer has everything it reads.
 * A renderer that dereferences missing state throws, and the app-level ErrorBoundary then
 * unmounts the whole wizard — every record the field agent has collected goes with it. So each
 * step's predicate below lists exactly the wizard state that step (and its submit) needs.
 *
 * Two prerequisites are stricter than the data alone: identity verification before the plot or
 * herd, and the boundary walk before the quote. The linear wizard always forced both, and the
 * stepper must not become a way to skip them.
 *
 * Each function returns why a step is locked, phrased as what to do next, or null when the step
 * may be opened. The first unmet prerequisite wins, so the reason always names the earliest gap.
 */

interface WithKyc {
  kycStatus?: string | null;
}

export interface FieldStepState {
  farmer: WithKyc | null;
  plot: unknown;
  boundaryResult: unknown;
  quote: unknown;
  policy: unknown;
}

export type FieldStepId =
  | 'register' | 'consent' | 'kyc' | 'plot' | 'walk' | 'review' | 'quote' | 'purchase' | 'payment';

export function fieldStepLockReason(id: FieldStepId, s: FieldStepState): string | null {
  // Re-walking rewrites the boundary of a plot that now carries a policy.
  if (id === 'walk' && s.policy) {
    return 'The policy has been purchased, so the boundary can no longer be re-walked here';
  }
  return fieldStepPrerequisiteGap(id, s);
}

/**
 * The earliest missing prerequisite of a crop step, or null. Unlike fieldStepLockReason it does
 * not lock the boundary walk after purchase, so the stepper keeps that step's tick.
 */
export function fieldStepPrerequisiteGap(id: FieldStepId, s: FieldStepState): string | null {
  const farmer = s.farmer ? null : 'Register the farmer first';
  const kyc = farmer ?? (s.farmer?.kycStatus === 'APPROVED' ? null : "Verify the farmer's identity first");
  const plot = kyc ?? (s.plot ? null : 'Create the plot first');
  const boundary = plot ?? (s.boundaryResult ? null : 'Walk the plot boundary first');
  const quote = boundary ?? (s.quote ? null : 'Get a premium quote first');

  switch (id) {
    case 'register': return null;
    case 'consent':
    case 'kyc': return farmer;
    case 'plot': return kyc;
    case 'walk': return plot;
    case 'review':
    case 'quote': return boundary;
    case 'purchase': return quote;
    case 'payment': return s.policy ? null : 'Purchase the policy first';
  }
}

export interface LivestockStepState {
  farmer: WithKyc | null;
  herd: unknown;
  quote: unknown;
  policy: unknown;
}

export type LivestockStepId = 'register' | 'consent' | 'kyc' | 'herd' | 'quote' | 'purchase' | 'payment';

export function livestockStepLockReason(id: LivestockStepId, s: LivestockStepState): string | null {
  const farmer = s.farmer ? null : 'Register the pastoralist first';
  const kyc = farmer ?? (s.farmer?.kycStatus === 'APPROVED' ? null : "Verify the pastoralist's identity first");
  const herd = kyc ?? (s.herd ? null : 'Register the herd first');
  const quote = herd ?? (s.quote ? null : 'Calculate the premium first');

  switch (id) {
    case 'register': return null;
    case 'consent':
    case 'kyc': return farmer;
    case 'herd': return kyc;
    case 'quote': return herd;
    case 'purchase': return quote;
    case 'payment': return s.policy ? null : 'Create the policy first';
  }
}

/**
 * True when the form values a quote was calculated from still match the form. A quote is only
 * good for the inputs it priced: once the agent edits the coverage form, the wizard treats the
 * quote as gone, which also locks Purchase again until it is recalculated. Values are compared
 * as strings because a number input can hand back "10000" for the 10000 that was quoted.
 */
export function quoteInputsMatch<T extends object>(current: Partial<T>, quoted: T | null): boolean {
  if (!quoted) return false;
  return (Object.keys(quoted) as (keyof T)[]).every(
    (key) => String(current[key] ?? '') === String(quoted[key] ?? ''),
  );
}

/** Shown on every other step while a request is in flight: its success handler moves the wizard. */
export const BUSY_REASON = 'Wait for the current request to finish';

/**
 * The current step plus the furthest one ever reached. `furthestStep` is what the stepper marks
 * as completed, so going back to an early step does not wipe the ticks off the ones after it.
 * `setCurrentStep` keeps the name the wizards already call it by.
 */
export function useStepProgress(initial = 0) {
  const [state, setState] = useState({ current: initial, furthest: initial });
  const setCurrentStep = useCallback((index: number) => {
    setState((prev) => ({ current: index, furthest: Math.max(prev.furthest, index) }));
  }, []);
  return { currentStep: state.current, furthestStep: state.furthest, setCurrentStep };
}
