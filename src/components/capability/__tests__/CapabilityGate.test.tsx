/**
 * THE GATE'S FOUR-WAY BRANCH, which is the single easiest thing in this slice to get wrong.
 *
 * The brief's three prohibitions map one-to-one onto the four states, and each is asserted:
 *
 *   NEVER A DEAD CONTROL   on a known deny the children are NOT rendered at all, so there is no
 *                          button to click and no 403 to receive.
 *   NEVER A RAW 403        the deny panel carries human copy and a next step, not a server
 *                          message and not an error styling.
 *   NEVER A FLASH          while loading, NEITHER the children NOR the deny panel render. A
 *                          three-armed branch that let 'loading' fall through to the deny panel
 *                          is the bug, and it is invisible in manual testing on a fast network.
 *
 * Plus the fourth state: when the map cannot be read at all, the copy must not borrow the deny
 * copy — that would tell a partner it lacks something we merely failed to look up — and must
 * offer a real retry.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  CapabilityGate,
  CapabilityNote,
  CapabilityNotOnPlanCard,
  CapabilityUnknownCard,
} from '@/components/capability/CapabilityGate';
import { CAPABILITY } from '@/lib/capability';

const CHILD = <button type="button">Download CSV</button>;

describe('CapabilityGate — enabled', () => {
  it('renders the children and nothing else', () => {
    render(
      <CapabilityGate capability={CAPABILITY.DATA_EXPORT} state="enabled">
        {CHILD}
      </CapabilityGate>,
    );
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.queryByText(/not on your plan/i)).not.toBeInTheDocument();
  });
});

describe('CapabilityGate — loading', () => {
  it('renders NEITHER the children NOR the deny panel', () => {
    render(
      <CapabilityGate capability={CAPABILITY.DATA_EXPORT} state="loading">
        {CHILD}
      </CapabilityGate>,
    );
    // The flash guard, in both directions.
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
    expect(screen.queryByText(/not on your plan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/couldn't confirm/i)).not.toBeInTheDocument();
  });

  it('marks the placeholder busy so assistive tech knows it is not the answer', () => {
    const { container } = render(
      <CapabilityGate capability={CAPABILITY.DATA_EXPORT} state="loading">
        {CHILD}
      </CapabilityGate>,
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});

describe('CapabilityGate — unavailable (a known deny)', () => {
  it('does not render the children, so there is no control to click', () => {
    render(
      <CapabilityGate capability={CAPABILITY.DATA_EXPORT} state="unavailable">
        {CHILD}
      </CapabilityGate>,
    );
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
  });

  it('says "not on your plan" and names the feature in words', () => {
    render(
      <CapabilityGate capability={CAPABILITY.BULK_IMPORT} state="unavailable">
        {CHILD}
      </CapabilityGate>,
    );
    expect(screen.getByText(/bulk farmer\/plot import is not on your plan/i)).toBeInTheDocument();
    expect(screen.queryByText(/BULK_IMPORT/)).not.toBeInTheDocument();
  });

  it('gives a next step rather than a dead end', () => {
    render(
      <CapabilityGate capability={CAPABILITY.DATA_EXPORT} state="unavailable">
        {CHILD}
      </CapabilityGate>,
    );
    expect(screen.getByText(/contact microcrop/i)).toBeInTheDocument();
  });

  it('does not read as an error or an outage', () => {
    render(<CapabilityNotOnPlanCard capability={CAPABILITY.DATA_EXPORT} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/error|failed|unavailable|try again/i)).not.toBeInTheDocument();
  });

  it('offers no retry — retrying will not grant a capability', () => {
    const onRetry = vi.fn();
    render(
      <CapabilityGate capability={CAPABILITY.DATA_EXPORT} state="unavailable" onRetry={onRetry}>
        {CHILD}
      </CapabilityGate>,
    );
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});

describe('CapabilityGate — unknown (we could not read the map)', () => {
  it('does not render the children', () => {
    render(
      <CapabilityGate capability={CAPABILITY.DATA_EXPORT} state="unknown">
        {CHILD}
      </CapabilityGate>,
    );
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
  });

  it('does NOT claim the partner lacks the capability', () => {
    render(
      <CapabilityGate capability={CAPABILITY.DATA_EXPORT} state="unknown">
        {CHILD}
      </CapabilityGate>,
    );
    expect(screen.getByText(/couldn't confirm what your plan includes/i)).toBeInTheDocument();
    expect(screen.queryByText(/not on your plan/i)).not.toBeInTheDocument();
  });

  it('offers a retry that actually fires', () => {
    const onRetry = vi.fn();
    render(
      <CapabilityGate capability={CAPABILITY.DATA_EXPORT} state="unknown" onRetry={onRetry}>
        {CHILD}
      </CapabilityGate>,
    );
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry button when no handler is given, rather than showing a dead one', () => {
    render(<CapabilityUnknownCard />);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});

describe('CapabilityNote — the inline variant', () => {
  it('renders nothing when the capability is enabled', () => {
    const { container } = render(
      <CapabilityNote capability={CAPABILITY.PARTNER_WEBHOOKS} state="enabled" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while loading, so the page does not jump for no information', () => {
    // A note sits beside content that is already on screen; a skeleton note would move the page
    // without saying anything. The CONTROL is what must be disabled during loading.
    const { container } = render(
      <CapabilityNote capability={CAPABILITY.PARTNER_WEBHOOKS} state="loading" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('uses role="note", matching the simulated-data and tier banners', () => {
    render(<CapabilityNote capability={CAPABILITY.PARTNER_WEBHOOKS} state="unavailable" />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('keeps the two non-enabled states distinguishable', () => {
    const { unmount } = render(
      <CapabilityNote capability={CAPABILITY.PARTNER_WEBHOOKS} state="unavailable" />,
    );
    expect(screen.getByText(/not on your plan/i)).toBeInTheDocument();
    unmount();

    render(<CapabilityNote capability={CAPABILITY.PARTNER_WEBHOOKS} state="unknown" />);
    expect(screen.getByText(/couldn't confirm/i)).toBeInTheDocument();
    expect(screen.queryByText(/not on your plan/i)).not.toBeInTheDocument();
  });
});
