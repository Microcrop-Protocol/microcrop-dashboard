import { ORG_ROLES } from '@/types';

type SubdomainContext = 'portal' | 'network' | 'unrestricted';

// Derived from the single role source. Hardcoding pairs here is how the four scoped
// roles ended up blocked from network.* while App.tsx happily routed them: they could
// authenticate and then be bounced by the subdomain gate.
const SUBDOMAIN_ROLES: Record<SubdomainContext, readonly string[]> = {
  portal: ['PLATFORM_ADMIN'],
  network: ORG_ROLES,
  unrestricted: ['PLATFORM_ADMIN', ...ORG_ROLES],
};

const SUBDOMAIN_LABELS: Record<Exclude<SubdomainContext, 'unrestricted'>, string> = {
  portal: 'Platform Portal',
  network: 'Organization Network',
};

export function getSubdomainContext(): SubdomainContext {
  const hostname = window.location.hostname;

  if (hostname.startsWith('portal.')) return 'portal';
  if (hostname.startsWith('network.')) return 'network';

  // localhost, IP addresses, preview deployments — no restriction
  return 'unrestricted';
}

export function isRoleAllowedOnSubdomain(role: string): boolean {
  const context = getSubdomainContext();
  return SUBDOMAIN_ROLES[context].includes(role);
}

export function getCorrectSubdomain(role: string): { url: string; label: string } | null {
  const context = getSubdomainContext();
  if (context === 'unrestricted') return null;

  if (role === 'PLATFORM_ADMIN' && context === 'network') {
    return {
      url: window.location.protocol + '//portal.' + window.location.hostname.replace(/^network\./, '') + '/login',
      label: SUBDOMAIN_LABELS.portal,
    };
  }

  if (role !== 'PLATFORM_ADMIN' && context === 'portal') {
    return {
      url: window.location.protocol + '//network.' + window.location.hostname.replace(/^portal\./, '') + '/login',
      label: SUBDOMAIN_LABELS.network,
    };
  }

  return null;
}
