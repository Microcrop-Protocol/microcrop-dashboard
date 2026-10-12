/**
 * INSURANCE UNITS — the platform list, per market.
 *
 *   1. THE MARKET FILTER REACHES THE SERVER as `?country=` (the list endpoint's own parameter),
 *      so a Ghana view never pages through Kenyan units. "All markets" sends no filter.
 *   2. EACH ROW'S RATES ARE IN ITS OWN MARKET'S CURRENCY. On the all-markets view rows from
 *      different markets sit side by side; each is labelled from its own `country`, and a row from
 *      a country this build does not know is left unlabelled rather than called KES.
 *   3. PER-TLU RATES KEEP TWO DECIMALS — a configured 1,512.50 is not shown as 1,513.
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InsuranceUnit } from '@/types';

const mocks = vi.hoisted(() => ({
  getInsuranceUnits: vi.fn(),
  createInsuranceUnit: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { getInsuranceUnits: mocks.getInsuranceUnits, createInsuranceUnit: mocks.createInsuranceUnit },
}));
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));

import InsuranceUnitsPage from '../InsuranceUnitsPage';

function unit(overrides: Partial<InsuranceUnit>): InsuranceUnit {
  return {
    id: 'u-ke',
    county: 'Marsabit',
    subCounty: 'Laisamis',
    unitCode: 'KE-10',
    country: 'KE',
    ndviBaselineLRLD: '0.450',
    ndviBaselineSRSD: '0.400',
    strikeLevelLRLD: '0.35',
    strikeLevelSRSD: '0.35',
    premiumRateLRLD: '1512.50',
    premiumRateSRSD: '1400.25',
    valuePerTLU: '15000',
    isActive: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <InsuranceUnitsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getInsuranceUnits.mockReset();
  mocks.createInsuranceUnit.mockReset();
});

describe('InsuranceUnitsPage', () => {
  it('asks for every market by default, and labels each row in its own currency', async () => {
    mocks.getInsuranceUnits.mockResolvedValue({
      data: [unit({}), unit({ id: 'u-ug', unitCode: 'UG-1', country: 'UG', county: 'Karamoja' })],
    });
    renderAt('/platform/insurance-units');

    const keRow = (await screen.findByText('KE-10')).closest('tr') as HTMLElement;
    expect(mocks.getInsuranceUnits).toHaveBeenCalledWith(undefined);
    expect(within(keRow).getByText('Kenya')).toBeInTheDocument();
    expect(within(keRow).getByText('Rate/TLU: KES 1,512.50')).toBeInTheDocument();
    expect(within(keRow).getByText('Rate/TLU: KES 1,400.25')).toBeInTheDocument();

    // A country this build does not know: its code, and its rate with NO currency.
    const ugRow = screen.getByText('UG-1').closest('tr') as HTMLElement;
    expect(within(ugRow).getByText('UG')).toBeInTheDocument();
    expect(within(ugRow).getByText('Rate/TLU: 1,512.50')).toBeInTheDocument();
    expect(within(ugRow).queryByText(/KES/)).not.toBeInTheDocument();

    // Across markets the area column names every market's label.
    expect(screen.getByRole('columnheader', { name: 'County / Region' })).toBeInTheDocument();
  });

  it('sends the selected market as ?country= and uses its own division label', async () => {
    mocks.getInsuranceUnits.mockResolvedValue({
      data: [unit({ id: 'u-gh', unitCode: 'GH-NP-01', country: 'GH', county: 'Northern', subCounty: undefined })],
    });
    renderAt('/platform/insurance-units?market=GH');

    const row = (await screen.findByText('GH-NP-01')).closest('tr') as HTMLElement;
    expect(mocks.getInsuranceUnits).toHaveBeenCalledWith({ country: 'GH' });
    expect(screen.getByRole('columnheader', { name: 'Region' })).toBeInTheDocument();
    expect(within(row).getByText('Ghana')).toBeInTheDocument();
    expect(within(row).getByText('Rate/TLU: GHS 1,512.50')).toBeInTheDocument();
    expect(within(row).queryByText(/KES/)).not.toBeInTheDocument();
  });

  it('shows a missing rate as a dash, not as zero', async () => {
    mocks.getInsuranceUnits.mockResolvedValue({
      data: [unit({ premiumRateLRLD: null as unknown as string })],
    });
    renderAt('/platform/insurance-units?market=KE');
    const row = (await screen.findByText('KE-10')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Rate/TLU: —')).toBeInTheDocument();
    expect(within(row).queryByText(/KES 0/)).not.toBeInTheDocument();
  });
});
