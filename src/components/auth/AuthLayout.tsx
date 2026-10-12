/**
 * The full-height split screen shared by sign-in and sign-up.
 *
 * Left: brand panel in the app's emerald tint, decorative. Right: the form, centred in a ~420px column.
 * Below 1024px the left panel is removed from the DOM entirely rather than hidden with
 * `lg:hidden` — it is purely decorative, and leaving it mounted would ship a screen reader
 * a second copy of the brand name before the heading on every small-screen sign-in.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { privacyUrl, termsUrl } from '@/lib/legal';
import { authMutedTextClass, authQuietLinkClass } from './auth-styles';

/**
 * The decorative half. `aria-hidden` because every word on it is either repeated by the
 * page heading or has no informational content; the logo is likewise marked decorative
 * rather than given alt text that would duplicate the wordmark beside it.
 */
function BrandPanel() {
  return (
    <div
      aria-hidden="true"
      className="auth-brand-panel relative hidden overflow-hidden bg-secondary lg:flex lg:w-1/2 lg:items-center lg:justify-center"
    >
      {/*
        A soft diagonal wash of the brand colour. Gradients rather than an image: no asset to
        download, no CSP surface, and it scales to any viewport. Static, so there is nothing
        for prefers-reduced-motion to switch off.
      */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-secondary to-background"
      />
      <div
        className="pointer-events-none absolute -left-1/4 top-1/4 h-[70%] w-[120%] -rotate-12 bg-gradient-to-r from-transparent via-primary/10 to-transparent blur-3xl"
      />

      <div className="relative flex flex-col items-center gap-6 px-12">
        <img
          src="/microcropsymb.png"
          alt=""
          width={140}
          height={140}
          className="h-32 w-32 object-contain xl:h-36 xl:w-36"
        />
        <span className="font-heading text-4xl font-semibold tracking-tight text-foreground xl:text-5xl">
          MicroCrop
        </span>
      </div>
    </div>
  );
}

/**
 * "© MicroCrop · Privacy · Terms".
 *
 * Terms is plain text, not a link, whenever there is no published terms page — which is the
 * state today. See lib/legal.ts for why we do not guess a /terms URL.
 */
function AuthFooter() {
  const terms = termsUrl();

  return (
    <footer className={`mt-10 text-center text-xs ${authMutedTextClass}`}>
      <p>
        <span>© MicroCrop</span>
        <span aria-hidden="true" className="px-1.5">
          ·
        </span>
        <a
          href={privacyUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className={authQuietLinkClass}
        >
          Privacy
        </a>
        <span aria-hidden="true" className="px-1.5">
          ·
        </span>
        {terms ? (
          <a href={terms} target="_blank" rel="noopener noreferrer" className={authQuietLinkClass}>
            Terms
          </a>
        ) : (
          <span>Terms</span>
        )}
      </p>
    </footer>
  );
}

interface AuthLayoutProps {
  /** Rendered as the page's only <h1>. */
  heading: string;
  /** Muted line beneath the heading. */
  subtitle: string;
  /** Rendered above the heading — used for the deactivated-organization alert. */
  banner?: ReactNode;
  /** Widen the column past the default 420px, for the longer sign-up step. */
  wide?: boolean;
  children: ReactNode;
}

export function AuthLayout({ heading, subtitle, banner, wide, children }: AuthLayoutProps) {
  return (
    // overflow-x-hidden is the backstop for the brief's "nothing may scroll horizontally":
    // the blurred decorative shape is deliberately wider than its panel, and a stray wide
    // child in the form column should clip rather than pan the whole document.
    <div className="flex min-h-screen w-full overflow-x-hidden bg-background">
      <BrandPanel />

      <main className="flex w-full flex-col justify-center px-5 py-12 sm:px-8 lg:w-1/2">
        <div className={`mx-auto w-full ${wide ? 'max-w-[520px]' : 'max-w-[420px]'}`}>
          {/*
            The brand repeated for small screens, where BrandPanel is not rendered. It is a
            link home rather than decoration here because it is the only way out of the page
            on mobile.
          */}
          <Link
            to="/"
            className={`mb-10 inline-flex items-center gap-2.5 rounded-sm lg:hidden ${authQuietLinkClass} hover:no-underline`}
          >
            <img
              src="/microcropsymb.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="font-heading text-lg font-semibold text-foreground">MicroCrop</span>
          </Link>

          {banner ? <div className="mb-6">{banner}</div> : null}

          <h1 className="font-heading text-[32px] font-bold leading-tight tracking-tight text-foreground sm:text-[36px]">
            {heading}
          </h1>
          <p className={`mt-2.5 text-[15px] ${authMutedTextClass}`}>{subtitle}</p>

          <div className="mt-8">{children}</div>

          <AuthFooter />
        </div>
      </main>
    </div>
  );
}
