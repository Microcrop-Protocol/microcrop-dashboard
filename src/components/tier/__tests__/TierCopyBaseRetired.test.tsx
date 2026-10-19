/**
 * BASE RETIRED: Determination & Settlement was a Base plan and the backend now refuses Tier 2
 * upgrades, quotes and sales with 409 BASE_RETIRED. With the switch off the dashboard must not
 * sell it (no upsell on Tier 1) nor tell a legacy Tier 2 org MicroCrop settles for it. The
 * switch set to "true" restores the original copy.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  TIER1_NO_SETTLEMENT_BODY,
  TIER1_UPGRADE_BODY,
  TIER2_RETIRED_NOTE,
  tier1UpgradeBody,
} from '@/lib/tier';

const tierState = vi.hoisted(() => ({ current: { state: 'determination', tier: 'DETERMINATION' } }));

vi.mock('@/hooks/useServiceTier', () => ({ useServiceTier: () => tierState.current }));
vi.mock('@/hooks/useCapabilities', () => ({
  useCapabilities: () => ({
    statuses: null,
    isLoading: true,
    isError: false,
    stateOf: () => 'loading',
    refetch: vi.fn(),
  }),
}));

import { OrgPlanPanel } from '@/components/settings/OrgPlanPanel';
import { SettlementNotOnPlanCard } from '../TierGate';

afterEach(() => {
  vi.unstubAllEnvs();
});

const renderCard = () =>
  render(
    <MemoryRouter>
      <SettlementNotOnPlanCard />
    </MemoryRouter>,
  );

describe('with Base retired (default)', () => {
  it('tier1UpgradeBody does not sell settlement', () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', '');
    expect(tier1UpgradeBody()).toBe(TIER1_NO_SETTLEMENT_BODY);
    expect(tier1UpgradeBody()).toMatch(/does not settle/);
  });

  it('the Tier 1 plan card carries no upsell', () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', '');
    renderCard();
    expect(screen.getByText(TIER1_NO_SETTLEMENT_BODY)).toBeInTheDocument();
    expect(screen.queryByText(TIER1_UPGRADE_BODY)).not.toBeInTheDocument();
  });

  it('the plan panel: Tier 1 gets no upsell, legacy Tier 2 gets the retired note', () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', '');
    tierState.current = { state: 'determination', tier: 'DETERMINATION' };
    const { unmount } = render(<OrgPlanPanel />);
    expect(screen.getByText(TIER1_NO_SETTLEMENT_BODY)).toBeInTheDocument();
    expect(screen.queryByText(TIER1_UPGRADE_BODY)).not.toBeInTheDocument();
    unmount();

    tierState.current = { state: 'settlement', tier: 'DETERMINATION_AND_SETTLEMENT' };
    render(<OrgPlanPanel />);
    expect(screen.getByText(TIER2_RETIRED_NOTE)).toBeInTheDocument();
    expect(screen.queryByText(/settles the payout to the farmer/)).not.toBeInTheDocument();
  });
});

describe('with the Base switch on', () => {
  it('restores the upsell and the settlement description', () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', 'true');
    expect(tier1UpgradeBody()).toBe(TIER1_UPGRADE_BODY);

    const card = renderCard();
    expect(screen.getByText(TIER1_UPGRADE_BODY)).toBeInTheDocument();
    card.unmount();

    tierState.current = { state: 'settlement', tier: 'DETERMINATION_AND_SETTLEMENT' };
    render(<OrgPlanPanel />);
    expect(screen.getByText(/settles the payout to the farmer/)).toBeInTheDocument();
    expect(screen.queryByText(TIER2_RETIRED_NOTE)).not.toBeInTheDocument();
  });
});
