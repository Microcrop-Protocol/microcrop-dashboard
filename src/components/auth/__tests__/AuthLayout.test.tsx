/**
 * The split-screen shell.
 *
 * jsdom has no layout engine, so the responsive half of this component — the left panel
 * collapsing below 1024px, nothing scrolling sideways — cannot be asserted here; those are
 * `lg:` utilities and an `overflow-x-hidden` backstop, checked by reading the classes and
 * by looking at the page. What IS testable is the document the shell produces, which is
 * where the accessibility regressions would hide:
 *
 *   The brand panel is decoration. It repeats the product name that the heading and the
 *   footer already carry, so it must not reach the accessibility tree — otherwise every
 *   sign-in starts with a screen reader reading "MicroCrop" twice before the user hears
 *   what page they are on.
 *
 *   There is exactly one h1, and it is the page's purpose.
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AuthLayout } from '../AuthLayout';

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderLayout(props: Partial<Parameters<typeof AuthLayout>[0]> = {}) {
  return render(
    <MemoryRouter>
      <AuthLayout heading="Sign in" subtitle="Welcome back! Please sign in to continue." {...props}>
        <button type="button">form content</button>
      </AuthLayout>
    </MemoryRouter>,
  );
}

describe('AuthLayout', () => {
  it('puts the form in a main landmark with the heading as its only h1', () => {
    renderLayout();

    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows the subtitle beneath the heading', () => {
    renderLayout();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it('keeps the decorative brand panel out of the accessibility tree', () => {
    const { container } = renderLayout();

    const panel = container.querySelector('[aria-hidden="true"].bg-\\[\\#0a0a0c\\]');
    expect(panel).toBeInTheDocument();
    // Its logo carries no alt text, so it contributes no stray image announcement either.
    expect(panel?.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('collapses the brand panel below the lg breakpoint rather than reflowing it', () => {
    const { container } = renderLayout();
    const panel = container.querySelector('[aria-hidden="true"].bg-\\[\\#0a0a0c\\]');

    expect(panel).toHaveClass('hidden');
    expect(panel).toHaveClass('lg:flex');
  });

  it('never lets the page scroll sideways', () => {
    const { container } = renderLayout();
    expect(container.firstElementChild).toHaveClass('overflow-x-hidden');
  });

  it('renders a banner above the heading when one is given', () => {
    renderLayout({ banner: <p>Organization deactivated</p> });
    expect(screen.getByText('Organization deactivated')).toBeInTheDocument();
  });

  it('offers a way home on small screens, where the brand panel is gone', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: /microcrop/i })).toHaveAttribute('href', '/');
  });

  it('links Terms once a terms page is published', () => {
    vi.stubEnv('VITE_TERMS_URL', 'https://microcrop.app/terms');
    renderLayout();

    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute(
      'href',
      'https://microcrop.app/terms',
    );
  });

  it('opens external legal links safely', () => {
    renderLayout();
    const privacy = screen.getByRole('link', { name: 'Privacy' });

    expect(privacy).toHaveAttribute('target', '_blank');
    expect(privacy).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
