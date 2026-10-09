/**
 * PLATFORM-ADMIN CAPABILITY TOGGLES.
 *
 * What this file pins, in the order the risks matter:
 *
 *   1. NOTHING IS OPTIMISTIC. A capability change alters what a partner may do and is recorded as
 *      a compliance decision. The switch must not move before the server agrees — painting it
 *      early shows the operator a state that does not exist if the write fails, and on this
 *      surface that is a wrong audit record rather than a stale UI.
 *
 *   2. THE REASON IS MANDATORY AND IS TAKEN FIRST. The backend refuses anything under 10
 *      characters in the validator and again in the service, so a toggle with an optional reason
 *      would just produce a validation error after the operator believed they had flipped it.
 *
 *   3. IMPLICIT DENY IS SHOWN AS ITSELF. `granted: false` (no row ever written) and
 *      `enabled: false, granted: true` (switched off, with a reason on file) both refuse the
 *      partner but are different operational situations; collapsing them hides "nobody has looked
 *      at this".
 *
 *   4. A FAILED READ SHOWS NO SWITCHES. A switch rendered from no data is a switch whose position
 *      is a guess, and clicking it would write that guess.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OrgCapabilitiesResponse } from '@/types';

const mocks = vi.hoisted(() => ({
  platformGetOrgCapabilities: vi.fn(),
  platformSetOrgCapability: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    platformGetOrgCapabilities: mocks.platformGetOrgCapabilities,
    platformSetOrgCapability: mocks.platformSetOrgCapability,
  },
}));
vi.mock('@/lib/notify', () => ({
  notifySuccess: mocks.notifySuccess,
  notifyError: mocks.notifyError,
}));

import { OrgCapabilitiesCard } from '@/components/platform/OrgCapabilitiesCard';

const RESPONSE: OrgCapabilitiesResponse = {
  organization: { id: 'org-1', name: 'Acme Cooperative' },
  capabilities: [
    {
      capability: 'CROP_UNDERWRITING',
      label: 'Crop underwriting',
      enabled: true,
      granted: true,
      reason: 'Backfill',
      grantedByUserId: 'system:migration',
      updatedAt: '2026-10-09T00:00:00.000Z',
    },
    {
      capability: 'LIVESTOCK_UNDERWRITING',
      label: 'Livestock (IBLI) underwriting',
      enabled: false,
      granted: false,
      reason: null,
      grantedByUserId: null,
      updatedAt: null,
    },
    {
      capability: 'BULK_IMPORT',
      label: 'Bulk farmer/plot import',
      enabled: false,
      granted: true,
      reason: 'Suspended pending AML review of the parent entity',
      grantedByUserId: 'admin-1',
      updatedAt: '2026-10-08T00:00:00.000Z',
    },
    {
      capability: 'DATA_EXPORT',
      label: 'Data export',
      enabled: true,
      granted: true,
      reason: null,
      grantedByUserId: null,
      updatedAt: null,
    },
    {
      capability: 'PARTNER_WEBHOOKS',
      label: 'Partner webhooks',
      enabled: false,
      granted: true,
      reason: null,
      grantedByUserId: null,
      updatedAt: null,
    },
    {
      capability: 'PARTNER_API_ACCESS',
      label: 'Partner API access',
      enabled: false,
      granted: true,
      reason: null,
      grantedByUserId: null,
      updatedAt: null,
    },
    {
      capability: 'SANDBOX_SIMULATION',
      label: 'Sandbox simulated payments',
      enabled: false,
      granted: true,
      reason: null,
      grantedByUserId: null,
      updatedAt: null,
    },
  ],
  history: [
    {
      id: 'c1',
      organizationId: 'org-1',
      capability: 'BULK_IMPORT',
      fromEnabled: true,
      toEnabled: false,
      reason: 'Suspended pending AML review of the parent entity',
      changedByUserId: 'admin-1',
      createdAt: '2026-10-08T00:00:00.000Z',
    },
    {
      id: 'c2',
      organizationId: 'org-1',
      capability: 'DATA_EXPORT',
      // NULL means there was no grant row: the capability was under IMPLICIT deny rather than
      // explicitly switched off.
      fromEnabled: null,
      toEnabled: true,
      reason: 'Enabled at partner request, ticket #4412',
      changedByUserId: 'admin-2',
      createdAt: '2026-10-07T00:00:00.000Z',
    },
  ],
};

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <OrgCapabilitiesCard orgId="org-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platformGetOrgCapabilities.mockResolvedValue(RESPONSE);
  mocks.platformSetOrgCapability.mockResolvedValue({
    organization: { id: 'org-1', name: 'Acme Cooperative' },
    capability: 'BULK_IMPORT',
    enabled: true,
    changed: true,
    fromEnabled: false,
  });
});

describe('the list', () => {
  it('renders a switch for every capability', async () => {
    renderCard();
    await screen.findByLabelText('Crop underwriting');
    expect(screen.getAllByRole('switch')).toHaveLength(RESPONSE.capabilities.length);
  });

  it('reflects each capability’s effective value', async () => {
    renderCard();
    expect(await screen.findByLabelText('Crop underwriting')).toBeChecked();
    expect(screen.getByLabelText('Bulk farmer/plot import')).not.toBeChecked();
  });

  it('distinguishes "never set" from "switched off"', async () => {
    renderCard();
    await screen.findByLabelText('Crop underwriting');
    // Exactly one capability in the fixture has granted:false.
    expect(screen.getAllByText('never set')).toHaveLength(1);
  });

  it('shows the operator reason on file, which this surface IS entitled to', async () => {
    renderCard();
    expect(
      await screen.findByText(/suspended pending AML review of the parent entity/i),
    ).toBeInTheDocument();
  });

  it('says what each capability unlocks, so an operator knows what stops working', async () => {
    renderCard();
    expect(await screen.findByText(/cover already sold is unaffected/i)).toBeInTheDocument();
  });

  it('says capabilities gate intake, and that settlement is NOT one of them', async () => {
    // An operator looking for "stop paying this partner's claims" must not conclude a capability
    // is the lever — that is the service tier, and the per-policy mode is frozen.
    renderCard();
    expect(await screen.findByText(/settlement is governed by the service tier/i)).toBeInTheDocument();
  });
});

describe('loading', () => {
  it('renders no switches before the map arrives', () => {
    mocks.platformGetOrgCapabilities.mockReturnValue(new Promise(() => {}));
    const { container } = renderCard();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});

describe('a failed read', () => {
  it('shows no switches, says no change was made, and offers a retry', async () => {
    mocks.platformGetOrgCapabilities.mockRejectedValue(new Error('boom'));
    renderCard();

    expect(await screen.findByText(/no change has been made/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('flipping a capability', () => {
  it('does not write anything on the switch alone — it opens the reason dialog', async () => {
    renderCard();
    fireEvent.click(await screen.findByLabelText('Bulk farmer/plot import'));

    expect(await screen.findByLabelText('Reason')).toBeInTheDocument();
    expect(mocks.platformSetOrgCapability).not.toHaveBeenCalled();
  });

  it('does not move the switch before the server agrees', async () => {
    renderCard();
    const toggle = await screen.findByLabelText('Bulk farmer/plot import');
    fireEvent.click(toggle);
    await screen.findByLabelText('Reason');

    // Still off: the dialog is open and nothing has been written.
    expect(screen.getByLabelText('Bulk farmer/plot import')).not.toBeChecked();
  });

  it('refuses a reason shorter than the backend accepts', async () => {
    renderCard();
    fireEvent.click(await screen.findByLabelText('Bulk farmer/plot import'));
    const reason = await screen.findByLabelText('Reason');

    fireEvent.change(reason, { target: { value: 'ok' } });
    const confirm = screen.getByRole('button', { name: /^enable$/i });
    expect(confirm).toBeDisabled();

    fireEvent.click(confirm);
    expect(mocks.platformSetOrgCapability).not.toHaveBeenCalled();
  });

  it('sends the capability, the new value and the trimmed reason', async () => {
    renderCard();
    fireEvent.click(await screen.findByLabelText('Bulk farmer/plot import'));
    fireEvent.change(await screen.findByLabelText('Reason'), {
      target: { value: '  Partner completed AML remediation, ticket #5120  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^enable$/i }));

    await waitFor(() => expect(mocks.platformSetOrgCapability).toHaveBeenCalled());
    expect(mocks.platformSetOrgCapability).toHaveBeenCalledWith(
      'org-1',
      'BULK_IMPORT',
      true,
      'Partner completed AML remediation, ticket #5120',
    );
  });

  it('warns that disabling stops intake but not cover already sold', async () => {
    renderCard();
    fireEvent.click(await screen.findByLabelText('Crop underwriting'));
    const dialog = await screen.findByRole('dialog');
    // Scoped to the dialog: the crop capability's own description says the same thing in the
    // list behind it, and asserting globally would pass even if the dialog said nothing.
    expect(dialog).toHaveTextContent(/cover already sold is unaffected/i);
    expect(screen.getByRole('button', { name: /^disable$/i })).toBeInTheDocument();
  });

  it('reports a failed write without claiming success', async () => {
    mocks.platformSetOrgCapability.mockRejectedValue(new Error('403'));
    renderCard();
    fireEvent.click(await screen.findByLabelText('Bulk farmer/plot import'));
    fireEvent.change(await screen.findByLabelText('Reason'), {
      target: { value: 'Partner completed AML remediation' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^enable$/i }));

    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
  });

  it('reports a no-op as a no-op rather than as a change', async () => {
    // The backend writes NO audit row when the value already matches, so saying "recorded"
    // would claim an audit entry that does not exist.
    mocks.platformSetOrgCapability.mockResolvedValue({
      organization: { id: 'org-1', name: 'Acme Cooperative' },
      capability: 'BULK_IMPORT',
      enabled: false,
      changed: false,
    });
    renderCard();
    fireEvent.click(await screen.findByLabelText('Bulk farmer/plot import'));
    fireEvent.change(await screen.findByLabelText('Reason'), {
      target: { value: 'Confirming the current state' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^enable$/i }));

    await waitFor(() => expect(mocks.notifySuccess).toHaveBeenCalled());
    expect(mocks.notifySuccess.mock.calls[0][0]).toMatch(/no change/i);
  });

  it('can be cancelled without writing anything', async () => {
    renderCard();
    fireEvent.click(await screen.findByLabelText('Bulk farmer/plot import'));
    await screen.findByLabelText('Reason');
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument());
    expect(mocks.platformSetOrgCapability).not.toHaveBeenCalled();
  });
});

describe('the change history', () => {
  it('is collapsed by default and expands on request', async () => {
    renderCard();
    const trigger = await screen.findByRole('button', { name: /show change history \(2\)/i });
    expect(screen.queryByText(/ticket #4412/)).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByText(/ticket #4412/)).toBeInTheDocument();
  });

  it('renders "never set" rather than "off" for an implicit-deny transition', async () => {
    // fromEnabled === null means nobody had ever decided. Rendering it as "off → on" would claim
    // a decision that was never made.
    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: /show change history/i }));
    expect(screen.getByText(/never set → on/)).toBeInTheDocument();
  });

  it('renders an explicit transition with both sides', async () => {
    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: /show change history/i }));
    expect(screen.getByText(/on → off/)).toBeInTheDocument();
  });
});
