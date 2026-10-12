/**
 * VERIFICATION (KYB) IN SETTINGS — every status the partner can be in, and the one thing it must
 * never be told.
 *
 * What this file pins, in the order the risks matter:
 *
 *   1. THE SCREENING VERDICT IS NEVER RENDERED. A RED Sumsub answer must not be readable by the
 *      organization being screened — not the answer, not the reject labels (SANCTIONS, PEP), not
 *      the internal override note. The backend's allow-list projection withholds them, and a
 *      test here asserts that even if a response somehow carried them the panel does not print
 *      them. This is the property the whole Sumsub integration exists to protect.
 *
 *   2. THE RETRYABLE CASE IS DISTINGUISHED FROM "UNDER REVIEW". A retryable rejection leaves the
 *      organization at PENDING_REVIEW, so a page that branched on status alone would say "we'll
 *      email you" to a partner whose submission can only be unblocked by its own action.
 *
 *   3. THE REQUIRED DOCUMENTS COME FROM THE SERVER. Ghana gets Ghana's list, Kenya gets Kenya's,
 *      and the dashboard holds no table of its own — a second answer would let a partner satisfy
 *      the list it was shown and still be refused by the submit.
 *
 *   4. THE REGISTRATION NUMBER IS MANDATORY HERE. It moved off signup, and `submitOrgKyb` refuses
 *      a submission while it is null. A form that let the partner submit without it would produce
 *      a 400 the page never warned about.
 *
 *   5. A REJECTION ALWAYS SAYS SOMETHING ACTIONABLE, note or no note.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OrgKyb } from '@/types';

const mocks = vi.hoisted(() => ({
  getMyKyb: vi.fn(),
  getMyOrganization: vi.fn(),
  submitMyKyb: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    getMyKyb: mocks.getMyKyb,
    getMyOrganization: mocks.getMyOrganization,
    submitMyKyb: mocks.submitMyKyb,
  },
}));
vi.mock('@/lib/notify', () => ({
  notifySuccess: mocks.notifySuccess,
  notifyError: mocks.notifyError,
}));

import { OrgVerificationPanel } from '@/components/settings/OrgVerificationPanel';

const KE_CHECKLIST: NonNullable<OrgKyb['checklist']> = {
  countryCode: 'KE',
  regulator: 'IRA',
  regulatorLicenseRequired: true,
  regulatorLicenseDocType: 'IRA_LICENSE',
  currency: 'KES',
  currencySymbol: 'KSh',
  adminDivisionLabels: { level1: 'County', level2: 'Sub-County' },
  requiredDocuments: [
    {
      documentType: 'BUSINESS_REGISTRATION',
      label: 'Business registration certificate',
      required: true,
      satisfied: false,
    },
    {
      documentType: 'TAX_CERTIFICATE',
      label: 'Tax certificate (KRA PIN)',
      required: true,
      satisfied: false,
    },
  ],
  optionalDocuments: [],
};

const GH_CHECKLIST: NonNullable<OrgKyb['checklist']> = {
  countryCode: 'GH',
  regulator: 'NIC',
  regulatorLicenseRequired: true,
  regulatorLicenseDocType: 'NIC_LICENSE',
  currency: 'GHS',
  currencySymbol: 'GH₵',
  adminDivisionLabels: { level1: 'Region', level2: 'District' },
  requiredDocuments: [
    {
      documentType: 'CERTIFICATE_OF_INCORPORATION',
      label: 'Certificate of Incorporation',
      required: true,
      satisfied: false,
    },
    { documentType: 'GHANA_TIN', label: 'Ghana TIN', required: true, satisfied: false },
    {
      documentType: 'NIC_LICENSE',
      label: 'NIC operating licence',
      required: true,
      satisfied: false,
    },
  ],
  optionalDocuments: [],
};

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OrgVerificationPanel />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMyOrganization.mockResolvedValue({
    id: 'org-1',
    name: 'Acme Cooperative',
    countryCode: 'KE',
    type: 'COOPERATIVE',
    registrationNumber: null,
    county: null,
  });
  mocks.submitMyKyb.mockResolvedValue({ id: 'kyb-1', status: 'UNDER_REVIEW' });
});

describe('NOT_STARTED', () => {
  beforeEach(() => {
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'NOT_STARTED',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: null,
    } satisfies OrgKyb);
  });

  it('shows the status and opens the submit form', async () => {
    renderPanel();
    expect(await screen.findByText('Not started')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument();
  });

  it('asks for the company registration number, which moved here from signup', async () => {
    renderPanel();
    expect(await screen.findByLabelText(/company registration number/i)).toBeInTheDocument();
    expect(
      screen.getByText(/must match the business-registration certificate/i),
    ).toBeInTheDocument();
  });

  it('blocks the submit while the registration number is missing, and says so', async () => {
    renderPanel();
    const button = await screen.findByRole('button', { name: /submit for review/i });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      /enter your company registration number/i,
    );
  });

  it('names the outstanding documents rather than leaving the button dead', async () => {
    renderPanel();
    await screen.findByRole('button', { name: /submit for review/i });
    expect(screen.getByRole('status')).toHaveTextContent(/business registration certificate/i);
    expect(screen.getByRole('status')).toHaveTextContent(/tax certificate/i);
  });
});

describe("the required documents are the server's, per country", () => {
  it('renders the Kenya list for a Kenyan organization', async () => {
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'NOT_STARTED',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: null,
    } satisfies OrgKyb);
    renderPanel();

    // Two matches are expected and correct: the requirements summary line lists every label,
    // and each upload slot carries its own heading. `findAllByText` asserts presence without
    // over-specifying which of the two it found.
    expect((await screen.findAllByText(/tax certificate \(kra pin\)/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ghana tin/i)).not.toBeInTheDocument();
  });

  it('renders the Ghana list, the NIC regulator and the Region label for a Ghanaian organization', async () => {
    mocks.getMyOrganization.mockResolvedValue({
      id: 'org-2',
      name: 'Accra Mutual',
      countryCode: 'GH',
      type: 'INSURANCE_COMPANY',
      registrationNumber: null,
      county: null,
    });
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'NOT_STARTED',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'GH',
      checklist: GH_CHECKLIST,
      verification: null,
    } satisfies OrgKyb);
    renderPanel();

    expect(
      (await screen.findAllByText(/certificate of incorporation/i)).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/ghana tin/i).length).toBeGreaterThan(0);
    // Regulator and the administrative-division label both come from the market.
    expect(screen.getAllByText(/NIC operating licence/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Region')).toBeInTheDocument();
    // And nothing Kenyan leaks in.
    expect(screen.queryByText(/kra pin/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('County')).not.toBeInTheDocument();
  });

  it('names the country in the requirements line', async () => {
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'NOT_STARTED',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'GH',
      checklist: GH_CHECKLIST,
      verification: null,
    } satisfies OrgKyb);
    renderPanel();
    expect(await screen.findByText(/required for ghana/i)).toBeInTheDocument();
  });
});

describe('PENDING_REVIEW', () => {
  beforeEach(() => {
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'PENDING_REVIEW',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: {
        id: 'v1',
        status: 'UNDER_REVIEW',
        documents: [
          {
            id: 'd1',
            documentType: 'BUSINESS_REGISTRATION',
            documentCode: 'BUSINESS_REGISTRATION',
            fileName: 'cert.pdf',
            fileUrl: '/uploads/kyb/cert.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            uploadedAt: '2026-10-01T00:00:00.000Z',
          },
        ],
      },
    } satisfies OrgKyb);
  });

  it('says it is under review and offers no resubmit form', async () => {
    renderPanel();
    expect(await screen.findByText('Under review')).toBeInTheDocument();
    expect(screen.getByText(/we'll email you once a decision is made/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument();
  });

  it('lists what is on file, with the per-market label rather than the raw code', async () => {
    renderPanel();
    expect(await screen.findByText('Business registration certificate')).toBeInTheDocument();
    expect(screen.getByText(/cert\.pdf/)).toBeInTheDocument();
  });
});

describe('the retryable screening case — PENDING_REVIEW that only the partner can unblock', () => {
  beforeEach(() => {
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'PENDING_REVIEW',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: {
        id: 'v1',
        status: 'UNDER_REVIEW',
        documentsResubmissionRequired: true,
        resubmissionNote: 'The registration certificate is not legible. Upload a clearer scan.',
        documents: [],
      },
    } satisfies OrgKyb);
  });

  it('says action is needed instead of "under review"', async () => {
    renderPanel();
    expect(await screen.findByText('Action needed')).toBeInTheDocument();
    expect(screen.queryByText(/we'll email you once a decision is made/i)).not.toBeInTheDocument();
  });

  it("renders the moderator's applicant-facing note verbatim", async () => {
    renderPanel();
    expect(
      await screen.findByText(/the registration certificate is not legible/i),
    ).toBeInTheDocument();
  });

  it('reopens the submit form, because resubmitting is the only way forward', async () => {
    renderPanel();
    expect(await screen.findByRole('button', { name: /submit for review/i })).toBeInTheDocument();
  });

  it('falls back to actionable copy when the provider sent no note', async () => {
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'PENDING_REVIEW',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: {
        id: 'v1',
        status: 'UNDER_REVIEW',
        documentsResubmissionRequired: true,
        resubmissionNote: null,
        documents: [],
      },
    } satisfies OrgKyb);
    renderPanel();
    expect(await screen.findByText(/upload clear, current copies/i)).toBeInTheDocument();
  });
});

describe('REJECTED', () => {
  it("shows the reviewer's note when there is one", async () => {
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'REJECTED',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: {
        id: 'v1',
        status: 'REJECTED',
        verifierNotes: 'The KRA PIN certificate belongs to a different entity.',
        documents: [],
      },
    } satisfies OrgKyb);
    renderPanel();

    expect(await screen.findByText(/belongs to a different entity/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument();
  });

  it('still says something actionable when the reviewer left no note', async () => {
    // The backend allows a rejection with no note, and "Your submission needs changes." with
    // nothing after it is a dead end.
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'REJECTED',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: { id: 'v1', status: 'REJECTED', verifierNotes: null, documents: [] },
    } satisfies OrgKyb);
    renderPanel();

    expect(await screen.findByText(/current, legible and matches/i)).toBeInTheDocument();
  });

  it('shows a per-document rejection reason, which IS actionable', async () => {
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'REJECTED',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: {
        id: 'v1',
        status: 'REJECTED',
        documents: [
          {
            id: 'd1',
            documentType: 'TAX_CERTIFICATE',
            documentCode: 'TAX_CERTIFICATE',
            fileName: 'pin.pdf',
            fileUrl: '/uploads/kyb/pin.pdf',
            fileSize: 10,
            mimeType: 'application/pdf',
            uploadedAt: '2026-10-01T00:00:00.000Z',
            rejectionReason: 'Expired — issued 2019.',
          },
        ],
      },
    } satisfies OrgKyb);
    renderPanel();

    expect(await screen.findByText(/expired — issued 2019/i)).toBeInTheDocument();
  });
});

describe('VERIFIED', () => {
  it('says so and offers no form', async () => {
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'VERIFIED',
      onboardingStep: 'COMPLETED',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: { id: 'v1', status: 'VERIFIED', documents: [] },
    } satisfies OrgKyb);
    renderPanel();

    expect(await screen.findByText('Verified')).toBeInTheDocument();
    expect(screen.getByText(/your organization is verified/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument();
  });

  it('warns about a licence that is about to lapse, because underwriting stops when it does', async () => {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString();
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'VERIFIED',
      onboardingStep: 'COMPLETED',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: {
        id: 'v1',
        status: 'VERIFIED',
        regulator: 'IRA',
        regulatorLicenseNumber: 'IRA/12345',
        licenseExpiresAt: soon,
        documents: [],
      },
    } satisfies OrgKyb);
    renderPanel();

    expect(await screen.findByText(/expires in 10 days/i)).toBeInTheDocument();
  });

  it('says a licence has already expired rather than counting down past zero', async () => {
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'VERIFIED',
      onboardingStep: 'COMPLETED',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: {
        id: 'v1',
        status: 'VERIFIED',
        regulator: 'IRA',
        regulatorLicenseNumber: 'IRA/12345',
        licenseExpiresAt: past,
        documents: [],
      },
    } satisfies OrgKyb);
    renderPanel();

    expect(await screen.findByText(/has expired/i)).toBeInTheDocument();
  });
});

describe('THE SCREENING VERDICT IS NEVER SHOWN TO THE SCREENED PARTY', () => {
  it('prints no verdict, no reject label and no override note even if a response carries them', async () => {
    // The backend's allow-list projection withholds these. This asserts the panel does not print
    // them either, so a projection regression cannot turn into a disclosure.
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'PENDING_REVIEW',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'KE',
      checklist: KE_CHECKLIST,
      verification: {
        id: 'v1',
        status: 'UNDER_REVIEW',
        documents: [],
        // Deliberately shaped like the fields the OLD response carried.
        sumsubReviewAnswer: 'RED',
        sumsubReviewStatus: 'completed',
        sumsubReviewPayload: { reviewResult: { rejectLabels: ['SANCTIONS', 'PEP'] } },
        screeningOverrideReason: 'Approved by compliance under manual review 2026-10-01',
      } as unknown as NonNullable<OrgKyb['verification']>,
    } as OrgKyb);
    renderPanel();

    await screen.findByText('Under review');
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/RED/);
    expect(body).not.toMatch(/SANCTIONS/i);
    expect(body).not.toMatch(/PEP/);
    expect(body).not.toMatch(/manual review/i);
    expect(body).not.toMatch(/sumsub/i);
    expect(body).not.toMatch(/screening/i);
  });
});

describe('the submitted payload', () => {
  beforeEach(() => {
    mocks.getMyKyb.mockResolvedValue({
      kybStatus: 'REJECTED',
      onboardingStep: 'KYB_VERIFICATION',
      countryCode: 'KE',
      checklist: {
        ...KE_CHECKLIST,
        // Documents already on file, so the submit is not blocked on uploads and the test can
        // exercise the entity fields alone.
        requiredDocuments: KE_CHECKLIST.requiredDocuments.map((d) => ({ ...d, satisfied: true })),
      },
      verification: {
        id: 'v1',
        status: 'REJECTED',
        verifierNotes: 'Registration number does not match.',
        regulatorLicenseNumber: 'IRA/12345',
        licenseExpiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        documents: [],
      },
    } satisfies OrgKyb);
  });

  it('sends the registration number, the type and the division as multipart fields', async () => {
    renderPanel();
    const registration = await screen.findByLabelText(/company registration number/i);
    fireEvent.change(registration, { target: { value: 'CPR/2024/0001' } });
    fireEvent.change(screen.getByLabelText('County'), { target: { value: 'Nakuru' } });

    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    await waitFor(() => expect(mocks.submitMyKyb).toHaveBeenCalled());
    const fd = mocks.submitMyKyb.mock.calls[0][0] as FormData;
    expect(fd.get('registrationNumber')).toBe('CPR/2024/0001');
    expect(fd.get('county')).toBe('Nakuru');
    // The licence block is prefilled from what is on file, so a resubmit does not make the
    // partner retype it.
    expect(fd.get('regulatorLicenseNumber')).toBe('IRA/12345');
  });

  it('prefills the licence fields from what is already on file', async () => {
    renderPanel();
    expect(await screen.findByDisplayValue('IRA/12345')).toBeInTheDocument();
  });
});

describe('a failed read', () => {
  it('does not render the form, and offers a retry', async () => {
    // The required-document set and the licence requirement are BOTH server-supplied, so a form
    // built with neither would let a partner submit a package refused for a reason the page
    // never mentioned.
    mocks.getMyKyb.mockRejectedValue(new Error('network'));
    renderPanel();

    expect(await screen.findByText(/couldn't load your verification status/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
