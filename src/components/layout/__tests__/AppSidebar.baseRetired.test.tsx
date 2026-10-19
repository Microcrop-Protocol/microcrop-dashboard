/**
 * The platform Treasury entry reads Base's PlatformTreasury contract. With Base retired it is
 * hidden from the nav; the Base switch brings it back.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  api: {
    getCatalogue: vi.fn().mockResolvedValue({ markets: [] }),
    getMyOrganization: vi.fn().mockResolvedValue(null),
    getMyCapabilities: vi.fn().mockResolvedValue({ capabilities: [] }),
    getMyPermissions: vi.fn().mockResolvedValue({ role: 'PLATFORM_ADMIN', permissions: ['*'] }),
  },
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      user: { id: 'u1', role: 'PLATFORM_ADMIN', organizationId: null },
      isPlatformAdmin: () => true,
    };
    return selector ? selector(state) : state;
  },
}));

import { AppSidebar } from '../AppSidebar';

function renderSidebar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AppSidebar isOpen onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('platform nav', () => {
  it('hides Treasury while Base is retired', () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', '');
    renderSidebar();
    expect(screen.getByText('Organizations')).toBeInTheDocument();
    expect(screen.queryByText('Treasury')).not.toBeInTheDocument();
  });

  it('shows Treasury with the Base switch on', () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', 'true');
    renderSidebar();
    expect(screen.getByText('Treasury')).toBeInTheDocument();
  });
});
