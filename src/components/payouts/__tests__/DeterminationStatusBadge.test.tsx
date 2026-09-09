/**
 * A deliberate non-settlement must never be rendered as a fault.
 *
 * DETERMINATION_ONLY is the terminal SUCCESS state of the Determination plan: MicroCrop
 * determined the outcome, signed it, and did not settle — because settling is the partner's
 * obligation under the plan it bought. Rendering it in the same red as FAILED or UNDERFUNDED
 * would tell a Tier 1 partner its product is broken on every determination it ever receives.
 *
 * This is the exact failure the three-facts model exists to prevent, and it is one careless
 * entry in a status map away at all times, so it is pinned here.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeterminationStatusBadge } from '../DeterminationStatusBadge';

const FAULT_WORDS = /fail|error|problem|wrong|unable|issue/i;

describe('DeterminationStatusBadge', () => {
  it('renders DETERMINATION_ONLY without falling back to the raw enum', () => {
    render(<DeterminationStatusBadge status="DETERMINATION_ONLY" />);
    expect(screen.getByText('Determination only')).toBeInTheDocument();
    expect(screen.queryByText('DETERMINATION_ONLY')).not.toBeInTheDocument();
  });

  it('does not describe a deliberate non-settlement as a failure', () => {
    render(<DeterminationStatusBadge status="DETERMINATION_ONLY" />);
    const badge = screen.getByText('Determination only');
    expect(badge.textContent ?? '').not.toMatch(FAULT_WORDS);
    expect(badge.closest('[title]')?.getAttribute('title') ?? '').not.toMatch(FAULT_WORDS);
  });

  it('says whose obligation settlement is, so the partner knows to act', () => {
    render(<DeterminationStatusBadge status="DETERMINATION_ONLY" />);
    const title = screen.getByText('Determination only').closest('[title]')?.getAttribute('title') ?? '';
    expect(title).toMatch(/your organization/i);
    expect(title).toMatch(/off-platform/i);
  });

  it('still renders genuine failures as failures — neutrality is not blanket', () => {
    const { unmount } = render(<DeterminationStatusBadge status="FAILED" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    unmount();
    render(<DeterminationStatusBadge status="UNDERFUNDED" />);
    expect(screen.getByText('Underfunded')).toBeInTheDocument();
  });
});
