import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Farmer, KYCStatus } from '@/types';

const mocks = vi.hoisted(() => ({
  updateFarmerKyc: vi.fn(),
  decideKyc: true,
}));

vi.mock('@/lib/api', () => ({
  api: { updateFarmerKyc: mocks.updateFarmerKyc },
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: { decideKyc: mocks.decideKyc } }),
}));

vi.mock('@/lib/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

import { FarmerKycDecision } from '../FarmerKycDecision';

function makeFarmer(kycStatus: KYCStatus): Farmer {
  return {
    id: 'farmer-1',
    organizationId: 'org-1',
    firstName: 'Wanjiku',
    lastName: 'Mwangi',
    phoneNumber: '+254700000000',
    nationalId: '12345678',
    county: 'Nakuru',
    kycStatus,
    plotsCount: 1,
    policiesCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function renderDecision(kycStatus: KYCStatus = 'PENDING') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FarmerKycDecision farmer={makeFarmer(kycStatus)} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.updateFarmerKyc.mockReset().mockResolvedValue(makeFarmer('APPROVED'));
  mocks.decideKyc = true;
});

describe('FarmerKycDecision', () => {
  it('shows the current KYC status', () => {
    renderDecision('PENDING');
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('approves a pending farmer through PUT /farmers/:id/kyc', async () => {
    renderDecision('PENDING');
    fireEvent.click(screen.getByRole('button', { name: /approve kyc/i }));
    await waitFor(() =>
      expect(mocks.updateFarmerKyc).toHaveBeenCalledWith('farmer-1', { status: 'APPROVED' }),
    );
  });

  it('requires a reason before a rejection can be submitted', async () => {
    renderDecision('PENDING');
    fireEvent.click(screen.getByRole('button', { name: /reject kyc/i }));

    const confirm = screen.getByRole('button', { name: /confirm rejection/i });
    expect(confirm).toBeDisabled();
    expect(mocks.updateFarmerKyc).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/reason for rejection/i), {
      target: { value: 'ID photo unreadable' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm rejection/i }));

    await waitFor(() =>
      expect(mocks.updateFarmerKyc).toHaveBeenCalledWith('farmer-1', {
        status: 'REJECTED',
        reason: 'ID photo unreadable',
      }),
    );
  });

  it('offers no decision control to a user without kyc:decide', () => {
    mocks.decideKyc = false;
    renderDecision('PENDING');
    expect(screen.queryByRole('button', { name: /approve kyc/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject kyc/i })).not.toBeInTheDocument();
    expect(screen.getByText(/only an organization admin/i)).toBeInTheDocument();
  });

  it('does not re-offer approval for an already approved farmer', () => {
    renderDecision('APPROVED');
    expect(screen.queryByRole('button', { name: /approve kyc/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject kyc/i })).toBeInTheDocument();
  });
});
