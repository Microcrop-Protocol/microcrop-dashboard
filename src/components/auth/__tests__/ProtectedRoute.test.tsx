import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User } from '@/types';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    setAccessToken: vi.fn(),
    onUnauthorized: vi.fn(),
    refreshToken: vi.fn(),
    getAccessToken: vi.fn(),
  },
}));

// Mock subdomain — default to unrestricted (localhost)
vi.mock('@/lib/subdomain', () => ({
  isRoleAllowedOnSubdomain: vi.fn(() => true),
  getCorrectSubdomain: vi.fn(() => null),
}));

// Use vi.hoisted to ensure mock state is available when vi.mock factory runs
const mockState = vi.hoisted(() => ({
  isLoading: false,
  isAuthenticated: false,
  user: null as User | null,
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockState,
}));

import { ProtectedRoute } from '../ProtectedRoute';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'ORG_ADMIN',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderProtected(children: React.ReactNode, allowedRoles?: ('PLATFORM_ADMIN' | 'ORG_ADMIN' | 'ORG_STAFF')[]) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              {children}
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/platform/dashboard" element={<div>Platform Dashboard</div>} />
        <Route path="/org/dashboard" element={<div>Org Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    mockState.isLoading = false;
    mockState.isAuthenticated = false;
    mockState.user = null;
  });

  it('shows loading spinner when isLoading is true', () => {
    mockState.isLoading = true;

    const { container } = renderProtected(<div>Protected</div>);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    renderProtected(<div>Protected</div>);

    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects PLATFORM_ADMIN to platform dashboard when not in allowedRoles', () => {
    mockState.isAuthenticated = true;
    mockState.user = makeUser({ role: 'PLATFORM_ADMIN' });

    renderProtected(<div>Org only</div>, ['ORG_ADMIN']);

    expect(screen.queryByText('Org only')).not.toBeInTheDocument();
    expect(screen.getByText('Platform Dashboard')).toBeInTheDocument();
  });

  it('redirects ORG_ADMIN to org dashboard when not in allowedRoles', () => {
    mockState.isAuthenticated = true;
    mockState.user = makeUser({ role: 'ORG_ADMIN' });

    renderProtected(<div>Platform only</div>, ['PLATFORM_ADMIN']);

    expect(screen.queryByText('Platform only')).not.toBeInTheDocument();
    expect(screen.getByText('Org Dashboard')).toBeInTheDocument();
  });

  it('renders children when authenticated with allowed role', () => {
    mockState.isAuthenticated = true;
    mockState.user = makeUser({ role: 'ORG_ADMIN' });

    renderProtected(<div>Protected</div>, ['ORG_ADMIN', 'ORG_STAFF']);

    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('renders children when no allowedRoles specified', () => {
    mockState.isAuthenticated = true;
    mockState.user = makeUser({ role: 'ORG_STAFF' });

    renderProtected(<div>Any user</div>);

    expect(screen.getByText('Any user')).toBeInTheDocument();
  });
});
