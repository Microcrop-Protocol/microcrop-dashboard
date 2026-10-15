/**
 * The import page as the alternative to field and livestock onboarding: a herds tab exactly where
 * livestock onboarding is offered (Kenya, with livestock underwriting), none in Ghana; and a
 * partial import keeps the partner on the page with the failed rows rather than navigating away.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GH_CATALOGUE, KE_CATALOGUE } from '@/test/catalogue-fixtures';

const mocks = vi.hoisted(() => ({
  country: 'KE' as 'GH' | 'KE',
  livestock: true,
  getCatalogue: vi.fn(),
  getMyOrganization: vi.fn(),
  getMyCapabilities: vi.fn(),
  getMyPermissions: vi.fn(),
  bulkImportFarmers: vi.fn(),
  bulkImportPlots: vi.fn(),
  bulkImportHerds: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    getCatalogue: mocks.getCatalogue,
    getMyOrganization: mocks.getMyOrganization,
    getMyCapabilities: mocks.getMyCapabilities,
    getMyPermissions: mocks.getMyPermissions,
    bulkImportFarmers: mocks.bulkImportFarmers,
    bulkImportPlots: mocks.bulkImportPlots,
    bulkImportHerds: mocks.bulkImportHerds,
  },
}));
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      user: { id: 'u1', role: 'ORG_ADMIN', organizationId: 'org-1' },
      isPlatformAdmin: () => false,
    };
    return selector ? selector(state) : state;
  },
}));

import FarmerImportPage from '../FarmerImportPage';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/org/import']}>
        <Routes>
          <Route path="/org/import" element={<FarmerImportPage />} />
          <Route path="/org/farmers" element={<div>Farmers list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.country = 'KE';
  mocks.livestock = true;
  mocks.getCatalogue.mockReset().mockImplementation(async () => ({
    markets: [mocks.country === 'GH' ? GH_CATALOGUE : KE_CATALOGUE],
  }));
  mocks.getMyOrganization.mockReset().mockImplementation(async () => ({ id: 'org-1', countryCode: mocks.country }));
  mocks.getMyCapabilities.mockReset().mockImplementation(async () => ({
    capabilities: [
      { capability: 'BULK_IMPORT', enabled: true },
      { capability: 'LIVESTOCK_UNDERWRITING', enabled: mocks.livestock },
    ],
  }));
  mocks.getMyPermissions.mockReset().mockResolvedValue({ role: 'ORG_ADMIN', permissions: ['*'] });
  mocks.bulkImportFarmers.mockReset();
  mocks.bulkImportPlots.mockReset();
  mocks.bulkImportHerds.mockReset();
});

const farmersJson = JSON.stringify([
  { firstName: 'Wanjiru', lastName: 'Kamau', phoneNumber: '0712345678', nationalId: '12345678', county: 'Nakuru' },
  { firstName: 'Otieno', lastName: 'Ouma', phoneNumber: '0722345678', nationalId: '87654321', county: 'Nakuru' },
]);

async function importFarmersJson() {
  await screen.findByRole('tab', { name: 'Import Farmers' });
  fireEvent.click(screen.getAllByRole('button', { name: 'JSON' })[0]);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: farmersJson } });
  fireEvent.click(screen.getByRole('button', { name: /Import Farmers/ }));
}

describe('herds tab', () => {
  it('is offered in Kenya with livestock underwriting', async () => {
    renderPage();
    expect(await screen.findByRole('tab', { name: 'Import Herds' })).toBeInTheDocument();
  });

  it('is hidden in Ghana, which lists no livestock, and the page says why', async () => {
    mocks.country = 'GH';
    renderPage();
    expect(await screen.findByText(/livestock cover is not offered in Ghana/)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Import Herds' })).not.toBeInTheDocument();
  });

  it('is hidden when livestock underwriting is not enabled', async () => {
    mocks.livestock = false;
    renderPage();
    expect(await screen.findByText(/needs livestock underwriting/)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Import Herds' })).not.toBeInTheDocument();
  });
});

describe('after a farmers import', () => {
  it('stays on the page with the failed rows on a partial import', async () => {
    mocks.bulkImportFarmers.mockResolvedValue({
      imported: 1, skipped: 1, total: 2,
      errors: [{ row: 2, field: 'phoneNumber', message: 'Phone number +233… is not a Kenya number' }],
    });
    renderPage();
    await importFarmersJson();
    expect(await screen.findByText('Row 2 · phoneNumber: Phone number +233… is not a Kenya number')).toBeInTheDocument();
    expect(screen.getByText('1 imported · 1 failed')).toBeInTheDocument();
    expect(screen.queryByText('Farmers list')).not.toBeInTheDocument();
    // The JSON path ran the preparer: the rows were sent shaped, not as pasted.
    expect(mocks.bulkImportFarmers.mock.calls[0][0]).toHaveLength(2);
  });

  it('goes to the farmers list when every row landed', async () => {
    mocks.bulkImportFarmers.mockResolvedValue({ imported: 2, skipped: 0, total: 2, errors: [] });
    renderPage();
    await importFarmersJson();
    await waitFor(() => expect(screen.getByText('Farmers list')).toBeInTheDocument());
  });
});
