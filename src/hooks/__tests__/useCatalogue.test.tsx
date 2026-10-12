/**
 * useCatalogue — the organization's market catalogue, three-valued, never defaulted to Kenya.
 */
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GH_CATALOGUE, KE_CATALOGUE } from '@/test/catalogue-fixtures';

const mocks = vi.hoisted(() => ({
  getCatalogue: vi.fn(),
  getMyOrganization: vi.fn(),
  user: { id: 'u1', role: 'ORG_ADMIN', organizationId: 'org-1' } as Record<string, unknown> | null,
}));

vi.mock('@/lib/api', () => ({
  api: { getCatalogue: mocks.getCatalogue, getMyOrganization: mocks.getMyOrganization },
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = { user: mocks.user };
    return selector ? selector(state) : state;
  },
}));

import { useCatalogue, useLivestockNotOffered } from '@/hooks/useCatalogue';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mocks.user = { id: 'u1', role: 'ORG_ADMIN', organizationId: 'org-1' };
  mocks.getCatalogue.mockReset();
  mocks.getMyOrganization.mockReset();
});

describe('useCatalogue', () => {
  it('is loading, with no items, until the catalogue arrives', () => {
    mocks.getCatalogue.mockReturnValue(new Promise(() => {}));
    mocks.getMyOrganization.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCatalogue(), { wrapper });
    expect(result.current.state).toBe('loading');
    expect(result.current.crops).toEqual([]);
    expect(result.current.livestockOffered).toBeNull();
  });

  it("resolves to the organization's own market", async () => {
    mocks.getCatalogue.mockResolvedValue({ markets: [GH_CATALOGUE] });
    mocks.getMyOrganization.mockResolvedValue({ id: 'org-1', countryCode: 'GH' });
    const { result } = renderHook(() => useCatalogue(), { wrapper });

    await waitFor(() => expect(result.current.state).toBe('known'));
    expect(result.current.market?.countryCode).toBe('GH');
    expect(result.current.crops.map((c) => c.code)).toContain('SOYBEAN');
    expect(result.current.livestock).toEqual([]);
    expect(result.current.livestockOffered).toBe(false);
  });

  it('is unknown — and offers nothing — when the request fails', async () => {
    mocks.getCatalogue.mockRejectedValue(new Error('down'));
    mocks.getMyOrganization.mockResolvedValue({ id: 'org-1', countryCode: 'KE' });
    const { result } = renderHook(() => useCatalogue(), { wrapper });

    await waitFor(() => expect(result.current.state).toBe('unknown'));
    expect(result.current.market).toBeNull();
    expect(result.current.crops).toEqual([]);
  });

  it("is unknown when the response does not carry the organization's market", async () => {
    mocks.getCatalogue.mockResolvedValue({ markets: [KE_CATALOGUE] });
    mocks.getMyOrganization.mockResolvedValue({ id: 'org-1', countryCode: 'GH' });
    const { result } = renderHook(() => useCatalogue(), { wrapper });

    await waitFor(() => expect(mocks.getMyOrganization).toHaveBeenCalled());
    await waitFor(() => expect(result.current.state).toBe('unknown'));
    expect(result.current.crops).toEqual([]);
  });

  it('makes no request for a platform admin', () => {
    mocks.user = { id: 'p1', role: 'PLATFORM_ADMIN', organizationId: null };
    const { result } = renderHook(() => useCatalogue(), { wrapper });
    expect(mocks.getCatalogue).not.toHaveBeenCalled();
    expect(result.current.state).toBe('unknown');
  });
});

describe('useLivestockNotOffered', () => {
  it('names Ghana once the market is known', async () => {
    mocks.getCatalogue.mockResolvedValue({ markets: [GH_CATALOGUE] });
    mocks.getMyOrganization.mockResolvedValue({ id: 'org-1', countryCode: 'GH' });
    const { result } = renderHook(() => useLivestockNotOffered(), { wrapper });
    await waitFor(() => expect(result.current).toBe('Ghana'));
  });

  it('is null in Kenya, and while nothing is known', async () => {
    mocks.getCatalogue.mockResolvedValue({ markets: [KE_CATALOGUE] });
    mocks.getMyOrganization.mockResolvedValue({ id: 'org-1', countryCode: 'KE' });
    const { result } = renderHook(() => useLivestockNotOffered(), { wrapper });
    expect(result.current).toBeNull();
    await waitFor(() => expect(mocks.getCatalogue).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
