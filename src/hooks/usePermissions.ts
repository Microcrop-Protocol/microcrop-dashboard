/**
 * The single source of truth for what the current user may see and do in the dashboard.
 *
 * Prefers the live GET /api/staff/me/permissions endpoint; falls back to a role-derived
 * mirror (src/lib/permissions.ts) so guards render correctly on first paint / offline
 * rather than flashing the whole dashboard. Server-side gates are the real enforcement —
 * this only hides controls the user would get a 403 from.
 *
 * Gate on permissions, never role strings, so a new backend role needs no dashboard edits.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  deriveCan,
  grantsForRole,
  permissionMatches,
  type PermissionCan,
} from '@/lib/permissions';
import type { MyPermissions, UserRole } from '@/types';

export interface Permissions {
  role: UserRole | undefined;
  permissions: string[];
  can: PermissionCan;
  /** Backend roleHasPermission, mirrored: '*', exact, resource:*, or *:read for reads. */
  has: (permission: string) => boolean;
  hasAny: (permissions: string[]) => boolean;
  hasAll: (permissions: string[]) => boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

export function usePermissions(): Permissions {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const { data, isLoading } = useQuery<MyPermissions>({
    queryKey: ['me-permissions', user?.id],
    queryFn: () => api.getMyPermissions(),
    // Platform admins live on /platform and bypass org gating; skip the org-scoped call.
    enabled: Boolean(user) && role !== 'PLATFORM_ADMIN',
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Authoritative when present; otherwise the role-derived fallback keeps guards correct.
  const grants = data?.permissions ?? grantsForRole(role);
  const can = data?.can ?? deriveCan(role, grants);

  const has = (permission: string) => permissionMatches(grants, permission);

  return {
    role,
    permissions: grants,
    can,
    has,
    hasAny: (perms) => perms.some(has),
    hasAll: (perms) => perms.every(has),
    isAdmin: role === 'ORG_ADMIN' || role === 'PLATFORM_ADMIN',
    // Only "loading" before we have any basis at all; the fallback means we can render.
    isLoading: isLoading && grants.length === 0,
  };
}
