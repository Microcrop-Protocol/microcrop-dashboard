/**
 * A simulated (sandbox) record must be UNMISTAKABLE in a LIST, not only on a detail page.
 *
 * The backend can run premium collection, activation and payout settlement without money
 * (SIMULATE_PAYMENTS, see microcrop-backend/src/services/simulated-payment.service.js).
 * Those rows land in the same tables with the same statuses: a test policy reads ACTIVE, a
 * test payout reads COMPLETED. In a UAT they sit next to real ones, so if the dashboard
 * renders them identically an operator can believe a farmer is covered, or report test
 * payouts as money disbursed.
 *
 * Each test renders the REAL page against a payload shaped like the real API response, with
 * ONE simulated record and ONE real one, and asserts the marker lands on the simulated row
 * and NOT on the real one. The negative half matters as much as the positive: a marker on
 * everything is as useless as a marker on nothing.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Payout, Policy } from '@/types';

const mocks = vi.hoisted(() => ({
  getPolicies: vi.fn(),
  getPayouts: vi.fn(),
  retryPayout: vi.fn(),
  getDamageAssessments: vi.fn(),
  getPolicy: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    getPolicies: mocks.getPolicies,
    getPayouts: mocks.getPayouts,
    retryPayout: mocks.retryPayout,
    getDamageAssessments: mocks.getDamageAssessments,
    getPolicy: mocks.getPolicy,
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { organizationId: 'org-1' } }),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: { writePolicies: false, retryPayouts: false } }),
}));

vi.mock('@/lib/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

import PoliciesPage from '../PoliciesPage';
import PayoutsPage from '../PayoutsPage';
import PolicyDetailPage from '../PolicyDetailPage';

/** The badge text, as a matcher tolerant of the whitespace JSX introduces. */
const MARKER = /TEST DATA/i;

function basePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: 'policy-real',
    policyNumber: 'POL-REAL-0001',
    organizationId: 'org-1',
    farmerId: 'farmer-1',
    farmerName: 'Wanjiku Mwangi',
    plotId: 'plot-1',
    plotName: 'North Field',
    status: 'ACTIVE',
    coverageType: 'DROUGHT',
    cropType: 'MAIZE',
    sumInsured: '50000',
    premium: '2500',
    platformFee: '250',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-06-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    // A real, settled activation: decimal uint256 id, 0x hash, positive height.
    onChainPolicyId: '4213',
    txHash: '0x' + 'a'.repeat(64),
    blockNumber: '18450231',
    ...overrides,
  };
}

/** Exactly what simulateOnChainActivation() writes onto the Policy row. */
function simulatedPolicy(overrides: Partial<Policy> = {}): Policy {
  return basePolicy({
    id: 'policy-sim',
    policyNumber: 'POL-SIM-0002',
    farmerName: 'Otieno Ochieng',
    onChainPolicyId: 'SIMULATED-NO-CHAIN-POLICY-A1B2C3D4E5F6',
    txHash: 'SIMULATED-NO-CHAIN-TX-A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4',
    blockNumber: '-1',
    ...overrides,
  });
}

function basePayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: 'payout-real',
    policyId: 'policy-real',
    policyNumber: 'POL-REAL-0001',
    farmerId: 'farmer-1',
    farmerName: 'Wanjiku Mwangi',
    farmerPhone: '+254700000000',
    amount: 12000,
    status: 'COMPLETED',
    createdAt: '2026-03-01T00:00:00Z',
    mpesaRef: 'QK12AB34CD',
    policy: { policyNumber: 'POL-REAL-0001', onChainPolicyId: '4213' },
    ...overrides,
  };
}

/** Exactly what settleSimulatedPayout() writes onto the Payout row. */
function simulatedPayout(overrides: Partial<Payout> = {}): Payout {
  return basePayout({
    id: 'payout-sim',
    policyId: 'policy-sim',
    policyNumber: 'POL-SIM-0002',
    farmerName: 'Otieno Ochieng',
    amount: 8000,
    mpesaRef: 'SIMULATED-NO-REAL-MONEY-0A1B2C3D4E5F',
    policy: {
      policyNumber: 'POL-SIM-0002',
      onChainPolicyId: 'SIMULATED-NO-CHAIN-POLICY-A1B2C3D4E5F6',
    },
    ...overrides,
  });
}

function renderPage(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** PolicyDetailPage reads `policyId` from the route, so it needs a matching path. */
function renderPolicyDetail(policyId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/org/policies/${policyId}`]}>
        <Routes>
          <Route path="/org/policies/:policyId" element={<PolicyDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function rowFor(text: string): Promise<HTMLElement> {
  await waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());
  const row = screen.getByText(text).closest('tr');
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

beforeEach(() => {
  mocks.getPolicies.mockReset();
  mocks.getPayouts.mockReset();
  mocks.getPolicy.mockReset();
  mocks.getDamageAssessments.mockReset();
  mocks.getDamageAssessments.mockResolvedValue({ data: [] });
  mocks.getPayouts.mockResolvedValue({ data: [] });
});

describe('policies list', () => {
  it('marks the simulated policy and leaves the real one unmarked', async () => {
    mocks.getPolicies.mockResolvedValue({
      data: [basePolicy(), simulatedPolicy()],
      total: 2,
    });

    renderPage(<PoliciesPage />);

    const simRow = await rowFor('POL-SIM-0002');
    const realRow = await rowFor('POL-REAL-0001');

    expect(within(simRow).getByText(MARKER)).toBeInTheDocument();
    expect(within(realRow).queryByText(MARKER)).not.toBeInTheDocument();

    // Both rows still read ACTIVE — which is exactly why the marker has to be
    // something other than the status.
    expect(within(simRow).getByText('ACTIVE')).toBeInTheDocument();
    expect(within(realRow).getByText('ACTIVE')).toBeInTheDocument();
  });

  it('warns above the table that some rows are test data, in plain words', async () => {
    mocks.getPolicies.mockResolvedValue({
      data: [basePolicy(), simulatedPolicy()],
      total: 2,
    });

    renderPage(<PoliciesPage />);

    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent(/no real money/i);
    expect(note).toHaveTextContent(/1 of these 2 policies is test data/i);
    // The wording must not lean on an internal env-var name.
    expect(note).not.toHaveTextContent(/SIMULATE_PAYMENTS/);
  });

  it('shows no warning at all when every policy is real', async () => {
    mocks.getPolicies.mockResolvedValue({ data: [basePolicy()], total: 1 });

    renderPage(<PoliciesPage />);

    await rowFor('POL-REAL-0001');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByText(MARKER)).not.toBeInTheDocument();
  });
});

describe('payouts list', () => {
  it('marks the simulated payout and leaves the real one unmarked', async () => {
    mocks.getPayouts.mockResolvedValue({
      data: [basePayout(), simulatedPayout()],
      total: 2,
    });

    renderPage(<PayoutsPage />);

    const simRow = await rowFor('POL-SIM-0002');
    const realRow = await rowFor('POL-REAL-0001');

    expect(within(simRow).getByText(MARKER)).toBeInTheDocument();
    expect(within(realRow).queryByText(MARKER)).not.toBeInTheDocument();
    expect(within(simRow).getByText('COMPLETED')).toBeInTheDocument();
  });

  it('marks a sandbox payout that has not settled yet, via its policy', async () => {
    // No mpesaRef exists until settlement, so the parent policy is the only signal
    // while the payout is in flight.
    mocks.getPayouts.mockResolvedValue({
      data: [simulatedPayout({ status: 'PROCESSING', mpesaRef: null })],
      total: 1,
    });

    renderPage(<PayoutsPage />);

    const simRow = await rowFor('POL-SIM-0002');
    expect(within(simRow).getByText(MARKER)).toBeInTheDocument();
  });

  it('says how much of the headline total is not real money', async () => {
    mocks.getPayouts.mockResolvedValue({
      data: [basePayout(), simulatedPayout()],
      total: 2,
    });

    renderPage(<PayoutsPage />);

    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent(/1 of these 2 payouts is test data/i);
    expect(note).toHaveTextContent(/KES 8,000/);
    expect(note).toHaveTextContent(/no money reached any farmer/i);
  });

  it('shows no warning when every payout is real', async () => {
    mocks.getPayouts.mockResolvedValue({ data: [basePayout()], total: 1 });

    renderPage(<PayoutsPage />);

    await rowFor('POL-REAL-0001');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByText(MARKER)).not.toBeInTheDocument();
  });
});

describe('policy detail', () => {
  it('marks a simulated policy and its payout', async () => {
    mocks.getPolicy.mockResolvedValue(simulatedPolicy());
    mocks.getPayouts.mockResolvedValue({ data: [simulatedPayout()], total: 1 });

    renderPolicyDetail('policy-sim');

    await waitFor(() => expect(screen.getByText('POL-SIM-0002')).toBeInTheDocument());

    // Badge in the header, banner in the body, and the payout row marked too.
    expect(screen.getAllByText(MARKER).length).toBeGreaterThanOrEqual(2);
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/no premium was collected/i);
    expect(note).toHaveTextContent(/no farmer is covered/i);
  });

  it('leaves a real policy and its payout unmarked', async () => {
    mocks.getPolicy.mockResolvedValue(basePolicy());
    mocks.getPayouts.mockResolvedValue({ data: [basePayout()], total: 1 });

    renderPolicyDetail('policy-real');

    await waitFor(() => expect(screen.getByText('POL-REAL-0001')).toBeInTheDocument());

    expect(screen.queryByText(MARKER)).not.toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
