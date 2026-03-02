import { create } from 'zustand';
import { User } from '../types';
import { authService } from '../services/authService';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** loginToken da mostrare come QR dopo la registrazione; null = già visto */
  pendingQrToken: string | null;

  login: (email: string, password: string) => Promise<void>;
  loginWithQr: (loginToken: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearPendingQr: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  pendingQrToken: null,

  login: async (email, password) => {
    const { token, user } = await authService.login(email, password);
    set({ token, user, isAuthenticated: true, pendingQrToken: null });
  },

  loginWithQr: async (loginToken: string) => {
    const { token, user } = await authService.qrLogin(loginToken);
    set({ token, user, isAuthenticated: true, pendingQrToken: null });
  },

  register: async (name, email, password) => {
    const { token, user } = await authService.register(name, email, password);
    set({ token, user, isAuthenticated: true, pendingQrToken: user.loginToken ?? null });
  },

  clearPendingQr: () => set({ pendingQrToken: null }),

  logout: async () => {
    await authService.logout();
    set({ token: null, user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    try {
      const storedToken = await authService.getStoredToken();
      if (storedToken) {
        const user = await authService.getMe();
        set({ token: storedToken, user, isAuthenticated: true });
      }
    } catch {
      await authService.logout();
    } finally {
      set({ isLoading: false });
    }
  },
}));
