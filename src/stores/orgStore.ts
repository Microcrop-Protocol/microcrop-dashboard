import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Organization, OrganizationStats, LiquidityPool } from '@/types';

interface OrgState {
  currentOrg: Organization | null;
  stats: OrganizationStats | null;
  pool: LiquidityPool | null;
  isLoading: boolean;
  
  // Actions
  setCurrentOrg: (org: Organization | null) => void;
  setStats: (stats: OrganizationStats | null) => void;
  setPool: (pool: LiquidityPool | null) => void;
  setLoading: (isLoading: boolean) => void;
  reset: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      currentOrg: null,
      stats: null,
      pool: null,
      isLoading: false,

      setCurrentOrg: (currentOrg) => set({ currentOrg }),
      setStats: (stats) => set({ stats }),
      setPool: (pool) => set({ pool }),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => set({ currentOrg: null, stats: null, pool: null, isLoading: false }),
    }),
    {
      name: 'microcrop-org',
      partialize: (state) => ({ 
        currentOrg: state.currentOrg 
      }),
    }
  )
);
