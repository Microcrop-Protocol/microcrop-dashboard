import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';

const user = {
  id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'ORG_ADMIN',
  organizationId: 'o1', isActive: true, createdAt: '2026-01-01',
} as User;

function BrokenPage(): JSX.Element {
  throw new Error('Dashboard exploded');
}

describe('a page that throws inside the dashboard shell', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })));
    useAuthStore.setState({
      user,
      isAuthenticated: true,
      isLoading: false,
      tokens: { accessToken: 'a.b.c', refreshToken: 'r1', expiresAt: Date.now() + 3600_000 },
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.unstubAllGlobals();
    useAuthStore.setState({ user: null, isAuthenticated: false, tokens: null });
  });

  it('keeps the sidebar mounted and clears the error after navigating', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/org/dashboard']}>
          <Routes>
            <Route path="/org" element={<DashboardLayout />}>
              <Route path="dashboard" element={<BrokenPage />} />
              <Route path="farmers" element={<div>Farmers page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // The error is contained to the page area; the shell is still there.
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    const sidebar = document.querySelector('aside');
    expect(sidebar).not.toBeNull();

    fireEvent.click(screen.getAllByRole('link', { name: /farmers/i })[0]);

    expect(screen.getByText('Farmers page')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    // Same DOM node: the sidebar was never unmounted.
    expect(document.querySelector('aside')).toBe(sidebar);
  });
});
