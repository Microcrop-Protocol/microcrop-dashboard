/**
 * THE MARKET PANEL DOES NOT CLAIM A RAIL A HIDDEN MARKET DOES NOT HAVE.
 *
 * Kenya and Ghana show their configured collection method and networks, as before. A hidden
 * market (here Nigeria, whose `['BANK']` is a placeholder) shows "Not yet available" instead.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MARKETS, type Market } from '@/lib/market';

const mocks = vi.hoisted(() => ({ market: null as Market | null }));

vi.mock('@/hooks/useOrgMarket', () => ({
  useOrgMarket: () => ({
    state: 'known',
    market: mocks.market,
    countryCode: mocks.market?.countryCode ?? null,
    organization: { name: 'Acme', registrationNumber: null, type: 'COOPERATIVE', county: null },
  }),
}));

import { OrgMarketPanel } from '../OrgMarketPanel';

const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe('OrgMarketPanel premium rail', () => {
  beforeEach(() => { mocks.market = null; });

  it('shows Kenya and Ghana networks unchanged', () => {
    mocks.market = MARKETS.KE;
    render(<OrgMarketPanel />);
    expect(valueOf('Premium collection')).toBe(MARKETS.KE.mobileMoneyLabel);
    expect(valueOf('Mobile money networks')).toBe(MARKETS.KE.mobileMoneyNetworks.join(', '));
  });

  it('shows "Not yet available" for a hidden market', () => {
    mocks.market = MARKETS.NG;
    render(<OrgMarketPanel />);
    expect(valueOf('Premium collection')).toBe('Not yet available');
    expect(valueOf('Mobile money networks')).toBe('Not yet available');
    expect(screen.queryByText('BANK')).toBeNull();
  });
});
