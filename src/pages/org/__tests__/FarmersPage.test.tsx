/**
 * CROSS-REPO SHAPE GUARD for the farmer table.
 *
 * `GET /farmers` returns the Prisma `Farmer` record with relation counts under
 * `_count: { plots, policies }` (farmer.service.js `include: { _count: ... }`).
 * The table read flat `plotsCount`/`policiesCount`, which the API has never
 * returned, so the Plots and Policies columns were blank for every farmer while
 * every dashboard test stayed green — the same drift class as the `phone` /
 * `phoneNumber` bug.
 *
 * These tests render the REAL page against a payload shaped like the real
 * response, so a regression to flat count fields shows up as blank cells here.
 */
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Farmer } from '@/types';

const mocks = vi.hoisted(() => ({
  getFarmers: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { getFarmers: mocks.getFarmers },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { organizationId: 'org-1' } }),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: { bulkImport: false, exportData: false, decideKyc: false } }),
}));

// The KYB banner runs its own query; this page's subject is the table.
vi.mock('@/components/kyb/KybGatingBanner', () => ({
  KybGatingBanner: () => null,
}));

vi.mock('@/lib/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

import FarmersPage from '../FarmersPage';

/** A farmer exactly as `GET /farmers` serialises it — counts under `_count`. */
function listFarmer(overrides: Partial<Farmer> = {}): Farmer {
  return {
    id: 'farmer-1',
    organizationId: 'org-1',
    firstName: 'Wanjiku',
    lastName: 'Mwangi',
    phoneNumber: '+254700000000',
    nationalId: '12345678',
    county: 'Nakuru',
    kycStatus: 'APPROVED',
    _count: { plots: 3, policies: 2 },
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FarmersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The one data row the table renders, found via a cell it always fills. */
async function dataRow(): Promise<HTMLElement> {
  await waitFor(() => expect(screen.getByText('Wanjiku')).toBeInTheDocument());
  const row = screen.getByText('Wanjiku').closest('tr');
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

beforeEach(() => {
  mocks.getFarmers.mockReset();
});

describe('FarmersPage relation counts', () => {
  it('renders plot and policy counts from the `_count` the API actually returns', async () => {
    mocks.getFarmers.mockResolvedValue({ data: [listFarmer()], total: 1 });

    renderPage();
    const row = await dataRow();

    // Blank cells here are the bug: the counts are present on the wire and the
    // table simply failed to read them.
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
  });

  it('renders a zero count rather than an empty cell', async () => {
    mocks.getFarmers.mockResolvedValue({
      data: [listFarmer({ _count: { plots: 0, policies: 0 } })],
      total: 1,
    });

    renderPage();
    const row = await dataRow();

    // A farmer with no plots must read "0", not blank — blank is what the bug
    // looked like, and the two must stay distinguishable.
    expect(within(row).getAllByText('0')).toHaveLength(2);
  });

  it('falls back to a dash when `_count` is absent, never to a silent zero', async () => {
    // GET /farmers/:id returns the full plots/policies arrays and NO `_count`,
    // so an absent `_count` is a real shape — it must not render as "0 plots".
    mocks.getFarmers.mockResolvedValue({
      data: [listFarmer({ _count: undefined })],
      total: 1,
    });

    renderPage();
    const row = await dataRow();

    expect(within(row).getAllByText('—')).toHaveLength(2);
    expect(within(row).queryByText('0')).not.toBeInTheDocument();
  });
});
