/**
 * The full-height split screen shared by sign-in and sign-up.
 *
 * Left: a photo of fields under an emerald wash, with the brand and tagline. Decorative. Right: the form, centred in a ~420px column.
 * Below 1024px the left panel is removed from the DOM entirely rather than hidden with
 * `lg:hidden` — it is purely decorative, and leaving it mounted would ship a screen reader
 * a second copy of the brand name before the heading on every small-screen sign-in.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { privacyUrl, termsUrl } from '@/lib/legal';
import { authMutedTextClass, authQuietLinkClass } from './auth-styles';

/**
 * The decorative half: a photograph of cultivated fields under an emerald-to-dark wash, with
 * the brand and the marketing site's own line set at the bottom.
 *
 * `aria-hidden` because nothing here is information the form side does not already carry;
 * the photo and the logo are decorative and carry empty alt text. The words are the eyebrow
 * and headline from microcrop.app's hero, so the first screen a partner sees in the product
 * says the same thing as the site that sent them here.
 *
 * The photo is /auth-fields.jpg (1400px, ~230 KB), the same image the marketing site uses.
 * The panel is display:none below lg, and an <img> there is still fetched unless it is lazy;
 * `loading="lazy"` is what keeps phones from downloading it.
 */
function BrandPanel() {
  return (
    <div
      aria-hidden="true"
      className="auth-brand-panel relative hidden overflow-hidden bg-primary lg:flex lg:w-1/2 lg:flex-col lg:justify-between"
    >
      <img
        src="/auth-fields.jpg"
        alt=""
        width={1400}
        height={933}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/*
        Two layers over the photo. The emerald multiply ties the image to the product's
        colour; the bottom-weighted dark gradient is what makes the white type legible
        regardless of which part of the field sits behind it. Static, so nothing here
        needs a prefers-reduced-motion switch.
      */}
      <div className="pointer-events-none absolute inset-0 bg-primary/35 mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />

      <div className="relative flex items-center gap-3 p-10 xl:p-12">
        {/* On a white tile: the green mark disappears against the sky in the photo. */}
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 shadow-sm">
          <img
            src="/microcropsymb.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
        </span>
        <span className="font-heading text-2xl font-semibold tracking-tight text-white drop-shadow-sm">
          MicroCrop
        </span>
      </div>

      <div className="relative max-w-xl p-10 xl:p-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/85">
          Climate cover, made practical
        </p>
        <p className="mt-4 font-heading text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
          A better way to protect the people who grow our food
        </p>
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

      {/* Below lg there is no photo panel, so a soft brand wash keeps the page from reading as blank white. */}
      <main className="flex w-full flex-col justify-center bg-gradient-to-b from-primary/10 via-background to-background px-5 py-12 sm:px-8 lg:w-1/2 lg:bg-none">
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
