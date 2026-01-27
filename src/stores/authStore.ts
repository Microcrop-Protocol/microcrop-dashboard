import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens, UserRole } from '@/types';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  
  // Helpers
  isPlatformAdmin: () => boolean;
  isOrgAdmin: () => boolean;
  isOrgStaff: () => boolean;
  hasRole: (role: UserRole) => boolean;
  isTokenExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setTokens: (tokens) => set({ tokens }),
      
      login: (user, tokens) => set({ 
        user, 
        tokens, 
        isAuthenticated: true,
        isLoading: false 
      }),
      
      logout: () => set({ 
        user: null, 
        tokens: null, 
        isAuthenticated: false,
        isLoading: false 
      }),
      
      setLoading: (isLoading) => set({ isLoading }),

      isPlatformAdmin: () => get().user?.role === 'PLATFORM_ADMIN',
      
      isOrgAdmin: () => get().user?.role === 'ORG_ADMIN',
      
      isOrgStaff: () => get().user?.role === 'ORG_STAFF',
      
      hasRole: (role) => get().user?.role === role,
      
      isTokenExpired: () => {
        const tokens = get().tokens;
        if (!tokens) return true;
        return Date.now() >= tokens.expiresAt;
      },
    }),
    {
      name: 'microcrop-auth',
      partialize: (state) => ({ 
        user: state.user, 
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);
