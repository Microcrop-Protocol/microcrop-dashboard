import { render, screen, fireEvent, act } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { useAuthStore } from '@/stores/authStore';
import { __resetChunkReloadForTests, navigateAway } from '@/lib/chunk-reload';
import type { User } from '@/types';

function Throw({ error }: { error?: Error }) {
  if (error) throw error;
  return <div>No error</div>;
}

const user = {
  id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'ORG_ADMIN',
  organizationId: 'o1', isActive: true, createdAt: '2026-01-01',
} as User;

// The messages browsers actually produce for a code-split chunk that can't be loaded.
const CHUNK_ERRORS: [string, Error][] = [
  ['Chrome', new TypeError('Failed to fetch dynamically imported module: https://app.microcrop.app/assets/OrgDashboard-3f9a1c.js')],
  ['Safari', new TypeError('Importing a module script failed.')],
  ['Firefox', new TypeError('error loading dynamically imported module: https://app.microcrop.app/assets/OrgDashboard-3f9a1c.js')],
  ['webpack-style', Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' })],
  ['Vite CSS', new Error('Unable to preload CSS for /assets/OrgDashboard-3f9a1c.css')],
];

describe('ErrorBoundary', () => {
  const reload = vi.fn();
  const originalLocation = window.location;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  function setLocation(pathname: string) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, pathname, href: `http://localhost${pathname}`, reload },
    });
  }

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __resetChunkReloadForTests();
    sessionStorage.clear();
    reload.mockClear();
    setLocation('/org/dashboard');
    useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: originalLocation });
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it('renders children when no error occurs', () => {
    render(<ErrorBoundary><div>Child content</div></ErrorBoundary>);
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('a real render error still shows the error screen and its message to a signed-in user', () => {
    render(<ErrorBoundary><Throw error={new Error('Test error')} /></ErrorBoundary>);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.queryByText('No error')).not.toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('"Try again" reloads the page (a state reset would only throw the same error again)', () => {
    render(<ErrorBoundary><Throw error={new Error('Test error')} /></ErrorBoundary>);
    fireEvent.click(screen.getByText('Try again'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('"Go to home" link points at the root path', () => {
    render(<ErrorBoundary><Throw error={new Error('Test error')} /></ErrorBoundary>);
    const link = screen.getByText('Go to home');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/');
  });

  it.each(CHUNK_ERRORS)('a %s chunk-load error shows "Updating…" and reloads once, not the error screen', (_browser, error) => {
    render(<ErrorBoundary><Throw error={error} /></ErrorBoundary>);

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.getByText('Updating…')).toBeInTheDocument();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a chunk that is still missing right after a reload shows the error instead of reloading again', () => {
    // The previous page lifetime reloaded for a stale chunk moments ago.
    sessionStorage.setItem('chunk_reload_at', String(Date.now()));

    render(<ErrorBoundary><Throw error={CHUNK_ERRORS[0][1]} /></ErrorBoundary>);

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/couldn't load the latest version/)).toBeInTheDocument();
  });

  it('a throw after sign-out on a protected page shows a loader, then goes to /login', () => {
    vi.useFakeTimers();
    useAuthStore.setState({ user: null, isAuthenticated: false });

    render(<ErrorBoundary><Throw error={new TypeError("Cannot read properties of null (reading 'role')")} /></ErrorBoundary>);

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(window.location.href).toBe('/login');
  });

  it('a throw on a public page with no user is NOT hidden', () => {
    setLocation('/login');
    useAuthStore.setState({ user: null, isAuthenticated: false });

    render(<ErrorBoundary><Throw error={new Error('Login page bug')} /></ErrorBoundary>);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Login page bug')).toBeInTheDocument();
  });

  it('a throw while a sign-out navigation is pending shows a loader', () => {
    navigateAway('/login');
    render(<ErrorBoundary><Throw error={new Error('torn down')} /></ErrorBoundary>);
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('clears the error when resetKey changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/org/a"><Throw error={new Error('Test error')} /></ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    rerender(<ErrorBoundary resetKey="/org/b"><Throw /></ErrorBoundary>);

    expect(screen.getByText('No error')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
