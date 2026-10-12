/**
 * PRODUCT CATALOGUE PAGE — read-only, per market, per line, with the server's status.
 *
 *   1. EVERY MARKET THE SERVER RETURNS IS SHOWN, each line separately, each item with its
 *      status badge and the server's own `sellable`.
 *   2. AN EMPTY LINE SAYS SO. Ghana's livestock list is empty by decision; the page states that
 *      no livestock is offered there rather than rendering an empty table.
 *   3. THE MARKET FILTER NARROWS THE VIEW without refetching per market.
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CatalogueItem, CatalogueResponse } from '@/types/catalogue';

const mocks = vi.hoisted(() => ({ getCatalogue: vi.fn() }));

vi.mock('@/lib/api', () => ({ api: { getCatalogue: mocks.getCatalogue } }));

import CataloguePage from '../CataloguePage';

function item(overrides: Partial<CatalogueItem>): CatalogueItem {
  return {
    code: 'MAIZE',
    label: 'Maize',
    status: 'AVAILABLE',
    sellable: true,
    peril: 'Drought',
    index: 'Rainfall deficit (CHIRPS)',
    coverPeriod: 'Long rains season',
    insurableUnit: 'Plot (acre)',
    precedent: 'KAIP / ACRE',
    ...overrides,
  };
}

const CATALOGUE: CatalogueResponse = {
  markets: [
    {
      countryCode: 'KE',
      countryName: 'Kenya',
      currency: 'KES',
      lines: {
        CROP: [
          item({}),
          item({ code: 'WHEAT', label: 'Wheat', status: 'COMING_SOON', sellable: false }),
        ],
        LIVESTOCK: [
          item({
            code: 'CAMEL',
            label: 'Camel',
            peril: 'Forage drought',
            index: 'Cumulative standardised NDVI',
            insurableUnit: 'TLU',
            precedent: 'KLIP / DRIVE',
            tluFactor: 1.4,
          }),
        ],
      },
    },
    {
      countryCode: 'GH',
      countryName: 'Ghana',
      currency: 'GHS',
      lines: {
        CROP: [item({ code: 'SOYBEAN', label: 'Soybean', status: 'PILOT', precedent: 'GAIP' })],
        LIVESTOCK: [],
      },
    },
  ],
};

function renderAt(path = '/platform/catalogue') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <CataloguePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getCatalogue.mockReset().mockResolvedValue(CATALOGUE);
});

describe('CataloguePage', () => {
  it('shows every market with its lines, statuses and sellability', async () => {
    renderAt();
    const ke = await screen.findByTestId('catalogue-KE');
    const crop = within(ke).getByRole('table', { name: 'Kenya crop products' });
    const maize = within(crop).getByText('Maize').closest('tr') as HTMLElement;
    expect(within(maize).getByText('Available')).toBeInTheDocument();
    expect(within(maize).getByText('Yes')).toBeInTheDocument();
    const wheat = within(crop).getByText('Wheat').closest('tr') as HTMLElement;
    expect(within(wheat).getByText('Coming soon')).toBeInTheDocument();
    expect(within(wheat).getByText('No')).toBeInTheDocument();

    const livestock = within(ke).getByRole('table', { name: 'Kenya livestock products' });
    expect(within(livestock).getByText('1.4')).toBeInTheDocument();
    expect(within(livestock).getByText('KLIP / DRIVE')).toBeInTheDocument();

    expect(within(ke).getByText('2 crop · 1 livestock · 2 sellable · 1 coming soon')).toBeInTheDocument();
  });

  it("shows the server's reason a pilot item is not sellable", async () => {
    mocks.getCatalogue.mockResolvedValue({
      markets: [
        {
          ...CATALOGUE.markets[1],
          lines: {
            CROP: [item({ code: 'SOYBEAN', label: 'Soybean', status: 'PILOT', sellable: false, reason: 'PRICING_NOT_CONFIGURED' })],
            LIVESTOCK: [],
          },
        },
      ],
    });
    renderAt();
    const gh = await screen.findByTestId('catalogue-GH');
    const soybean = within(gh).getByText('Soybean').closest('tr') as HTMLElement;
    expect(within(soybean).getByText('No')).toBeInTheDocument();
    expect(within(soybean).getByText('Pricing not configured yet')).toBeInTheDocument();
  });

  it("says plainly that Ghana offers no livestock", async () => {
    renderAt();
    const gh = await screen.findByTestId('catalogue-GH');
    expect(within(gh).getByText('No livestock products are offered in Ghana.')).toBeInTheDocument();
    expect(within(gh).getByText('Pilot')).toBeInTheDocument();
  });

  it('narrows to the selected market', async () => {
    renderAt('/platform/catalogue?market=GH');
    expect(await screen.findByTestId('catalogue-GH')).toBeInTheDocument();
    expect(screen.queryByTestId('catalogue-KE')).not.toBeInTheDocument();
  });

  it('says so when the catalogue cannot be loaded', async () => {
    mocks.getCatalogue.mockReset().mockRejectedValue(new Error('boom'));
    renderAt();
    expect(await screen.findByText("We couldn't load the product catalogue. Please try again.")).toBeInTheDocument();
  });
});
