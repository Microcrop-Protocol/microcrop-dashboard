/**
 * KYB REVIEW — the reviewer sees each organization's market and regulator.
 *
 * Approving a Ghanaian insurer against Kenya's regulator is approving the wrong thing. The card
 * shows the country and the regulator, and an organization with no market is "Market unknown",
 * never Kenya. The required-document checklist is the server's, fetched per organization.
 */
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OrgKyb, OrgKybReview } from '@/types';

const mocks = vi.hoisted(() => ({
  getKybReviews: vi.fn(),
  getOrgKyb: vi.fn(),
  reviewOrgKyb: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { getKybReviews: mocks.getKybReviews, getOrgKyb: mocks.getOrgKyb, reviewOrgKyb: mocks.reviewOrgKyb },
}));
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));

import OrgKybReviewPage from '../OrgKybReviewPage';

function review(overrides: Partial<OrgKybReview>): OrgKybReview {
  return {
    id: 'org-gh',
    name: 'Accra Mutual',
    type: 'INSURANCE_COMPANY',
    registrationNumber: 'CS-123',
    county: 'Greater Accra',
    countryCode: 'GH',
    regulator: 'NIC',
    kybStatus: 'PENDING_REVIEW',
    createdAt: '2026-10-01T00:00:00Z',
    kybVerification: null,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OrgKybReviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getKybReviews.mockReset();
  mocks.getOrgKyb.mockReset();
});

describe('OrgKybReviewPage', () => {
  it("shows a Ghanaian organization's country, regulator and Region label", async () => {
    mocks.getKybReviews.mockResolvedValue([review({})]);
    renderPage();
    expect(await screen.findByText('Accra Mutual')).toBeInTheDocument();
    expect(screen.getByTestId('kyb-market')).toHaveTextContent('Ghana');
    expect(screen.getByTestId('kyb-regulator')).toHaveTextContent('Regulator: NIC');
    expect(screen.getByText(/Region: Greater Accra/)).toBeInTheDocument();
    expect(screen.queryByText(/Kenya|IRA/)).not.toBeInTheDocument();
  });

  it('shows "Market unknown" rather than Kenya for an organization with no country', async () => {
    mocks.getKybReviews.mockResolvedValue([review({ countryCode: null, regulator: null })]);
    renderPage();
    await screen.findByText('Accra Mutual');
    expect(screen.getByTestId('kyb-market')).toHaveTextContent('Market unknown');
    expect(screen.getByTestId('kyb-regulator')).toHaveTextContent('Regulator: unknown');
    expect(screen.queryByText(/Kenya/)).not.toBeInTheDocument();
  });

  it("flags a licence issued by another market's regulator", async () => {
    mocks.getKybReviews.mockResolvedValue([
      review({
        kybVerification: {
          id: 'v1',
          status: 'UNDER_REVIEW',
          documents: [],
          regulator: 'IRA',
          regulatorLicenseNumber: 'IRA/123',
        },
      }),
    ]);
    renderPage();
    expect(await screen.findByText(/The licence names IRA, but Ghana is regulated by NIC/)).toBeInTheDocument();
  });

  it("loads the server's per-market checklist when opened", async () => {
    mocks.getKybReviews.mockResolvedValue([review({})]);
    const kyb: OrgKyb = {
      kybStatus: 'PENDING_REVIEW',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'GH',
      verification: null,
      checklist: {
        countryCode: 'GH',
        regulator: 'NIC',
        regulatorLicenseRequired: true,
        regulatorLicenseDocType: 'NIC_LICENSE',
        requiredDocuments: [
          { documentType: 'NIC_LICENSE', label: 'NIC licence', required: true, satisfied: false },
          { documentType: 'GHANA_TIN', label: 'Ghana TIN', required: true, satisfied: true },
        ],
        optionalDocuments: [],
      },
    };
    mocks.getOrgKyb.mockResolvedValue(kyb);
    renderPage();
    await screen.findByText('Accra Mutual');
    expect(mocks.getOrgKyb).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /required documents for this market/i }));
    const licence = await screen.findByText('NIC licence');
    expect(within(licence.closest('li') as HTMLElement).getByText('missing')).toBeInTheDocument();
    expect(within(screen.getByText('Ghana TIN').closest('li') as HTMLElement).getByText('provided')).toBeInTheDocument();
    expect(mocks.getOrgKyb).toHaveBeenCalledWith('org-gh');
  });
});
