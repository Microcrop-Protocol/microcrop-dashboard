import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  ConsentDocument,
  ConsentDocumentsResponse,
  ConsentStatus,
  FarmerConsentDocumentStatus,
  FarmerConsentStatus,
} from '@/types';

const mocks = vi.hoisted(() => ({
  getConsentDocuments: vi.fn(),
  getFarmerConsent: vi.fn(),
  recordFarmerConsent: vi.fn(),
  withdrawFarmerConsent: vi.fn(),
  editFarmers: true,
}));

vi.mock('@/lib/api', () => ({
  api: {
    getConsentDocuments: mocks.getConsentDocuments,
    getFarmerConsent: mocks.getFarmerConsent,
    recordFarmerConsent: mocks.recordFarmerConsent,
    withdrawFarmerConsent: mocks.withdrawFarmerConsent,
  },
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: { editFarmers: mocks.editFarmers } }),
}));

vi.mock('@/lib/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

import { FarmerConsentPanel } from '../FarmerConsentPanel';

// ---------------------------------------------------------------------------
// Fixtures — these mirror what the backend actually returns TODAY: placeholder
// documents with `body: null`, `approved: false` and an UNAPPROVED version string.
// ---------------------------------------------------------------------------

const PLACEHOLDER_WARNING =
  'PLACEHOLDER DOCUMENT — no approved consent wording exists yet. This version string is ' +
  'scaffolding, not a notice. Requires legal/DPO review and approved copy before any real ' +
  'farmer is asked to consent.';

const PLACEHOLDER_VERSION = '0.0.0-UNAPPROVED-PLACEHOLDER';

function registryDoc(overrides: Partial<ConsentDocument> = {}): ConsentDocument {
  return {
    documentId: 'FARMER_DATA_PROCESSING',
    version: PLACEHOLDER_VERSION,
    approved: false,
    required: true,
    purpose: 'Lawful basis for collecting and processing farmer personal data.',
    body: null,
    bodySha256: null,
    warning: PLACEHOLDER_WARNING,
    todo: 'TODO(LEGAL/DPO): author a compliant privacy notice.',
    ...overrides,
  };
}

function documentsResponse(
  docs: ConsentDocument[] = [registryDoc()],
): ConsentDocumentsResponse {
  const anyPlaceholder = docs.some((d) => !d.approved);
  return {
    documents: docs,
    approvedCopyAvailable: !anyPlaceholder,
    ...(anyPlaceholder ? { warning: PLACEHOLDER_WARNING } : {}),
  };
}

function docStatus(
  status: ConsentStatus,
  overrides: Partial<FarmerConsentDocumentStatus> = {},
): FarmerConsentDocumentStatus {
  const hasRecord = status !== 'NOT_GIVEN';
  return {
    documentId: 'FARMER_DATA_PROCESSING',
    requiredVersion: PLACEHOLDER_VERSION,
    required: true,
    documentApproved: false,
    purpose: 'Lawful basis for collecting and processing farmer personal data.',
    status,
    warning: PLACEHOLDER_WARNING,
    todo: 'TODO(LEGAL/DPO): author a compliant privacy notice.',
    consent: hasRecord
      ? {
          id: 'consent-1',
          documentVersion: status === 'SUPERSEDED' ? '0.0.0-OLDER' : PLACEHOLDER_VERSION,
          documentHash: null,
          method: 'IN_PERSON_VERBAL_ATTESTED',
          evidenceRef: null,
          locale: null,
          capturedByUserId: 'user-1',
          grantedAt: '2026-02-01T10:00:00Z',
          revokedAt: status === 'REVOKED' ? '2026-02-05T10:00:00Z' : null,
          revokedByUserId: status === 'REVOKED' ? 'user-2' : null,
          revokedReason: status === 'REVOKED' ? 'Farmer left the cooperative' : null,
          capturedAgainstPlaceholder: true,
        }
      : null,
    ...overrides,
  };
}

function statusResponse(
  docs: FarmerConsentDocumentStatus[],
  overrides: Partial<FarmerConsentStatus> = {},
): FarmerConsentStatus {
  return {
    farmerId: 'farmer-1',
    documents: docs,
    hasValidConsent: false,
    missing: docs
      .filter((d) => d.required && !(d.status === 'GRANTED' && d.documentApproved))
      .map((d) => ({ documentId: d.documentId, status: d.status })),
    enforcedOnPurchase: false,
    warning: PLACEHOLDER_WARNING,
    ...overrides,
  };
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FarmerConsentPanel farmerId="farmer-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.editFarmers = true;
  mocks.getConsentDocuments.mockReset().mockResolvedValue(documentsResponse());
  mocks.getFarmerConsent.mockReset().mockResolvedValue(statusResponse([docStatus('NOT_GIVEN')]));
  mocks.recordFarmerConsent.mockReset().mockResolvedValue({
    consent: { id: 'consent-new' },
    replayed: false,
    status: 'GRANTED',
    documentApproved: false,
  });
  mocks.withdrawFarmerConsent.mockReset().mockResolvedValue({
    consent: { id: 'consent-1' },
    alreadyRevoked: false,
    status: 'REVOKED',
  });
});

// ---------------------------------------------------------------------------

describe('FarmerConsentPanel — placeholder documents', () => {
  /**
   * The failure mode this whole screen is written to avoid: a page that LOOKS like it
   * is presenting terms to a farmer, filled with wording nobody approved. The only
   * text allowed in the document block is `body` as the API returns it.
   */
  it('shows no document text at all while the API returns body: null', async () => {
    renderPanel();

    const block = await screen.findByTestId('consent-document-text-FARMER_DATA_PROCESSING');
    expect(within(block).getByText(/returns no text for this document/i)).toBeInTheDocument();
    expect(within(block).getByText(/nothing for them to agree to/i)).toBeInTheDocument();

    // The version string is scaffolding — it must never be dressed up as a notice.
    expect(block.textContent).toContain(`Version in force: ${PLACEHOLDER_VERSION}`);

    // Whatever else changes, this block stays short: it carries the "no text"
    // statement and the version, and nothing that could be read as consent wording.
    expect(block.textContent?.length ?? 0).toBeLessThan(400);
  });

  it('renders the backend placeholder warning verbatim rather than paraphrasing it', async () => {
    renderPanel();
    // Once from the registry banner, once from the per-document warning.
    const shown = await screen.findAllByText(PLACEHOLDER_WARNING);
    expect(shown.length).toBeGreaterThan(0);
  });

  it('states prominently that nothing here can be shown to a farmer', async () => {
    renderPanel();
    expect(
      await screen.findByText(/nothing here can be presented to a farmer/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Legal\/DPO-reviewed copy has to land in the backend registry/i),
    ).toBeInTheDocument();
  });

  it('warns that capture against an unapproved document is not usable consent', async () => {
    renderPanel();
    expect(
      await screen.findByText(/refuses the request outright in production/i),
    ).toBeInTheDocument();
  });

  it('renders the document body verbatim once the API actually returns one', async () => {
    // Deliberately not consent-shaped copy: the assertion is pass-through, not wording.
    const approved = registryDoc({
      approved: true,
      version: '1.0.0',
      body: 'SERVER-SUPPLIED-DOCUMENT-TEXT',
      bodySha256: 'abc123',
      warning: undefined,
      todo: undefined,
    });
    mocks.getConsentDocuments.mockResolvedValue(documentsResponse([approved]));
    mocks.getFarmerConsent.mockResolvedValue(
      statusResponse([
        docStatus('NOT_GIVEN', {
          documentApproved: true,
          requiredVersion: '1.0.0',
          warning: undefined,
          todo: undefined,
        }),
      ]),
    );

    renderPanel();

    const block = await screen.findByTestId('consent-document-text-FARMER_DATA_PROCESSING');
    expect(within(block).getByText('SERVER-SUPPLIED-DOCUMENT-TEXT')).toBeInTheDocument();
    expect(block.textContent).toContain('abc123');
    expect(screen.queryByText(/no approved consent wording exists yet/i)).not.toBeInTheDocument();
  });
});

describe('FarmerConsentPanel — enforcement honesty', () => {
  it('says consent is not enforced on purchase when the API reports it is not', async () => {
    renderPanel();
    expect(
      await screen.findByText(/consent is not enforced on policy purchase/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/enforcedOnPurchase = false/)).toBeInTheDocument();
    expect(screen.getByText(/it does not gate anything/i)).toBeInTheDocument();
  });

  it('flips the message if the backend ever reports the gate is on', async () => {
    mocks.getFarmerConsent.mockResolvedValue(
      statusResponse([docStatus('GRANTED')], { enforcedOnPurchase: true }),
    );
    renderPanel();
    expect(
      await screen.findByText(/consent is enforced on policy purchase/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/enforcedOnPurchase = false/)).not.toBeInTheDocument();
  });
});

describe('FarmerConsentPanel — status rendering', () => {
  it.each([
    ['NOT_GIVEN', 'NOT GIVEN'],
    ['GRANTED', 'GRANTED'],
    ['REVOKED', 'REVOKED'],
    ['SUPERSEDED', 'SUPERSEDED'],
  ] as const)('renders %s with its own badge', async (status, label) => {
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus(status)]));
    renderPanel();
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  /**
   * A withdrawn consent must never read as one that was never asked for. An operator
   * who confuses the two will re-ask a farmer who exercised the right to withdraw.
   */
  it('never lets REVOKED read as NOT_GIVEN', async () => {
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus('REVOKED')]));
    renderPanel();

    expect(await screen.findByText('REVOKED')).toBeInTheDocument();
    expect(screen.queryByText('NOT GIVEN')).not.toBeInTheDocument();
    expect(screen.queryByText(/never been asked/i)).not.toBeInTheDocument();
    expect(screen.getByText(/then withdrew it/i)).toBeInTheDocument();
    // The withdrawal itself is part of the record and has to be visible.
    expect(screen.getByText(/Farmer left the cooperative/)).toBeInTheDocument();
  });

  it('explains SUPERSEDED as an older version rather than an absence of consent', async () => {
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus('SUPERSEDED')]));
    renderPanel();
    expect(await screen.findByText('SUPERSEDED')).toBeInTheDocument();
    expect(screen.getByText(/older version of this document/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.0\.0-OLDER/)).toBeInTheDocument();
  });

  it('flags a grant captured against unapproved wording as not counting', async () => {
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus('GRANTED')]));
    renderPanel();
    expect(await screen.findByText('GRANTED')).toBeInTheDocument();
    expect(screen.getByText(/the backend does not count it as valid consent/i)).toBeInTheDocument();
  });
});

describe('FarmerConsentPanel — capture', () => {
  it('requires a capture method before consent can be recorded', async () => {
    renderPanel();

    const button = await screen.findByRole('button', { name: /record consent/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.recordFarmerConsent).not.toHaveBeenCalled();
  });

  it('records consent with the method the agent chose', async () => {
    renderPanel();

    fireEvent.click(await screen.findByLabelText(/in person — verbal, attested by the agent/i));
    fireEvent.click(screen.getByRole('button', { name: /record consent/i }));

    await waitFor(() =>
      expect(mocks.recordFarmerConsent).toHaveBeenCalledWith('farmer-1', {
        documentId: 'FARMER_DATA_PROCESSING',
        method: 'IN_PERSON_VERBAL_ATTESTED',
        evidenceRef: undefined,
        locale: undefined,
      }),
    );
  });

  it('offers every method the backend enum accepts', async () => {
    renderPanel();
    await screen.findByLabelText(/in person — verbal/i);
    for (const label of [
      /in person — verbal/i,
      /in person — farmer signature/i,
      /^SMS reply$/i,
      /^USSD$/i,
      /^web form$/i,
      /paper record import/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('passes an evidence reference through when one is given', async () => {
    renderPanel();

    fireEvent.click(await screen.findByLabelText(/paper record import/i));
    fireEvent.change(screen.getByLabelText(/evidence reference/i), {
      target: { value: 'FORM-2026-0042' },
    });
    fireEvent.click(screen.getByRole('button', { name: /record consent/i }));

    await waitFor(() =>
      expect(mocks.recordFarmerConsent).toHaveBeenCalledWith('farmer-1', {
        documentId: 'FARMER_DATA_PROCESSING',
        method: 'PAPER_RECORD_IMPORT',
        evidenceRef: 'FORM-2026-0042',
        locale: undefined,
      }),
    );
  });

  /**
   * Nothing is presented in any language while `body` is null, so asking which
   * language it was presented in would invite a false record.
   */
  it('hides the language field while the document has no approved wording', async () => {
    renderPanel();
    await screen.findByRole('button', { name: /record consent/i });
    expect(screen.queryByLabelText(/language presented/i)).not.toBeInTheDocument();
  });

  it('offers the language field once the document is approved', async () => {
    mocks.getConsentDocuments.mockResolvedValue(
      documentsResponse([registryDoc({ approved: true, version: '1.0.0', body: 'TEXT' })]),
    );
    mocks.getFarmerConsent.mockResolvedValue(
      statusResponse([docStatus('NOT_GIVEN', { documentApproved: true, requiredVersion: '1.0.0' })]),
    );

    renderPanel();
    expect(await screen.findByLabelText(/language presented/i)).toBeInTheDocument();
  });

  it('re-offers capture after a withdrawal, since re-consenting is legitimate', async () => {
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus('REVOKED')]));
    renderPanel();
    expect(await screen.findByRole('button', { name: /record consent again/i })).toBeInTheDocument();
  });
});

describe('FarmerConsentPanel — withdrawal', () => {
  it('withdraws a standing grant, carrying the reason', async () => {
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus('GRANTED')]));
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /withdraw consent/i }));
    fireEvent.change(screen.getByLabelText(/reason for withdrawal/i), {
      target: { value: 'Farmer asked us to stop' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm withdrawal/i }));

    await waitFor(() =>
      expect(mocks.withdrawFarmerConsent).toHaveBeenCalledWith('farmer-1', {
        documentId: 'FARMER_DATA_PROCESSING',
        reason: 'Farmer asked us to stop',
      }),
    );
  });

  it('allows withdrawal without a reason — the reason is optional server-side', async () => {
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus('GRANTED')]));
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /withdraw consent/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm withdrawal/i }));

    await waitFor(() =>
      expect(mocks.withdrawFarmerConsent).toHaveBeenCalledWith('farmer-1', {
        documentId: 'FARMER_DATA_PROCESSING',
        reason: undefined,
      }),
    );
  });

  it('can withdraw a SUPERSEDED grant, which is still a standing grant', async () => {
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus('SUPERSEDED')]));
    renderPanel();
    expect(await screen.findByRole('button', { name: /withdraw consent/i })).toBeInTheDocument();
  });

  // The backend 404s a withdrawal with nothing behind it rather than fabricating a
  // revocation, so the control must not be offered.
  it.each(['NOT_GIVEN', 'REVOKED'] as const)(
    'offers no withdrawal for %s',
    async (status) => {
      mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus(status)]));
      renderPanel();
      await screen.findByRole('button', { name: /record consent/i });
      expect(screen.queryByRole('button', { name: /withdraw consent/i })).not.toBeInTheDocument();
    },
  );
});

describe('FarmerConsentPanel — permissions', () => {
  it('offers no capture or withdrawal control without farmer:update', async () => {
    mocks.editFarmers = false;
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus('GRANTED')]));
    renderPanel();

    expect(await screen.findByText(/do not have permission to record or withdraw/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /record consent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /withdraw consent/i })).not.toBeInTheDocument();
  });

  it('still shows the status to a read-only user', async () => {
    mocks.editFarmers = false;
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus('REVOKED')]));
    renderPanel();
    expect(await screen.findByText('REVOKED')).toBeInTheDocument();
  });
});

describe('FarmerConsentPanel — failure modes', () => {
  it('reports a failed status load instead of rendering an empty consent screen', async () => {
    mocks.getFarmerConsent.mockRejectedValue(new Error('boom'));
    renderPanel();
    expect(await screen.findByText(/couldn't load this farmer's consent status/i)).toBeInTheDocument();
  });

  it('still renders per-document status when the registry call fails', async () => {
    // The status response carries its own warning and purpose, so the screen degrades
    // to "no text available" rather than going blank.
    mocks.getConsentDocuments.mockRejectedValue(new Error('boom'));
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([docStatus('GRANTED')]));
    renderPanel();

    expect(await screen.findByText('GRANTED')).toBeInTheDocument();
    const block = screen.getByTestId('consent-document-text-FARMER_DATA_PROCESSING');
    expect(within(block).getByText(/returns no text for this document/i)).toBeInTheDocument();
  });

  it('handles an empty document list from the API', async () => {
    mocks.getConsentDocuments.mockResolvedValue(documentsResponse([]));
    mocks.getFarmerConsent.mockResolvedValue(statusResponse([]));
    renderPanel();
    expect(await screen.findByText(/returned no consent documents/i)).toBeInTheDocument();
  });
});
