/**
 * Client mirror of the backend permission model (microcrop-backend src/utils/constants.js).
 *
 * This is a FALLBACK only — the authoritative source is GET /api/staff/me/permissions.
 * usePermissions prefers the live endpoint and falls back to this role-derived map when the
 * endpoint hasn't resolved yet (first paint / offline), so guards never flash the whole
 * dashboard. Enforcement is 100% server-side; this is UX hiding on top.
 *
 * Keep in step with the backend ROLE_PERMISSIONS. If they drift, the live endpoint still
 * wins whenever it's reachable.
 */
import type { UserRole } from '@/types';

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  PLATFORM_ADMIN: ['*'],
  ORG_ADMIN: ['*'],
  ORG_STAFF: [
    'farmer:*', 'plot:*', 'herd:*', 'policy:read', 'policy:create',
    'damage:*', 'satellite:read', 'dashboard:read', 'payout:read',
  ],
  ORG_FIELD_AGENT: [
    'payout:read', 'farmer:*', 'plot:*', 'herd:*', 'damage:create',
    'damage:read', 'satellite:read', 'policy:read', 'dashboard:read',
  ],
  ORG_FINANCE: [
    'payout:*', 'reserve:*', 'financials:read', 'export:*', 'policy:read',
    'farmer:read', 'dashboard:read',
  ],
  ORG_UNDERWRITER: [
    'payout:read', 'policy:*', 'farmer:read', 'plot:read', 'herd:read',
    'satellite:read', 'dashboard:read',
  ],
  ORG_VIEWER: [
    'farmer:read', 'plot:read', 'herd:read', 'policy:read', 'payout:read',
    'damage:read', 'satellite:read', 'financials:read', 'dashboard:read',
  ],
};

/** Mirrors backend roleHasPermission over a permissions[] list. */
export function permissionMatches(grants: string[], permission: string): boolean {
  if (grants.includes('*')) return true;
  if (grants.includes(permission)) return true;
  const [resource, action] = permission.split(':');
  if (grants.includes(`${resource}:*`)) return true;
  if (action === 'read' && grants.includes('*:read')) return true;
  return false;
}

export interface PermissionCan {
  manageStaff: boolean;
  exportData: boolean;
  retryPayouts: boolean;
  writePolicies: boolean;
  editFarmers: boolean;
  bulkImport: boolean;
  decideKyc: boolean;
}

/** Derive the can{} flags exactly as the backend /me/permissions endpoint does. */
export function deriveCan(role: UserRole | undefined, grants: string[]): PermissionCan {
  const has = (p: string) => permissionMatches(grants, p);
  return {
    manageStaff: role === 'ORG_ADMIN' || role === 'PLATFORM_ADMIN',
    exportData: has('export:farmers'),
    retryPayouts: has('payout:retry'),
    writePolicies: has('policy:create'),
    editFarmers: has('farmer:update'),
    bulkImport: has('import:farmers'),
    decideKyc: has('kyc:decide'),
  };
}

export function grantsForRole(role: UserRole | undefined): string[] {
  return (role && ROLE_PERMISSIONS[role]) || [];
}
