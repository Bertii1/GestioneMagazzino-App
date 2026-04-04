import { create } from 'zustand';
import { User } from '../types';
import { authService } from '../services/authService';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  /** loginToken da mostrare come QR dopo la registrazione; null = già visto */
  pendingQrToken: string | null;

  login: (email: string, password: string) => Promise<void>;
  loginWithQr: (loginToken: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearPendingQr: () => void;
  clearMustChangePassword: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  mustChangePassword: false,
  pendingQrToken: null,

  login: async (email, password) => {
    const { token, user, mustChangePassword } = await authService.login(email, password);
    set({
      token,
      user,
      isAuthenticated: true,
      mustChangePassword: mustChangePassword ?? false,
      pendingQrToken: null,
    });
  },

  loginWithQr: async (loginToken: string) => {
    const { token, user, mustChangePassword } = await authService.qrLogin(loginToken);
    set({
      token,
      user,
      isAuthenticated: true,
      mustChangePassword: mustChangePassword ?? false,
      pendingQrToken: null,
    });
  },

  clearPendingQr: () => set({ pendingQrToken: null }),

  clearMustChangePassword: () => set({ mustChangePassword: false }),

  logout: async () => {
    await authService.logout();
    set({ token: null, user: null, isAuthenticated: false, mustChangePassword: false });
  },

  restoreSession: async () => {
    try {
      const storedToken = await authService.getStoredToken();
      if (storedToken) {
        const user = await authService.getMe();
        set({
          token: storedToken,
          user,
          isAuthenticated: true,
          mustChangePassword: user.mustChangePassword ?? false,
        });
      }
    } catch {
      await authService.logout();
    } finally {
      set({ isLoading: false });
    }
  },
}));
