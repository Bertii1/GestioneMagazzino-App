import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { AuthResponse, User } from '../types';

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    await AsyncStorage.setItem('auth_token', data.token);
    return data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<{ user: User }>('/auth/me');
    return data.user;
  },

  async logout(): Promise<void> {
    await AsyncStorage.removeItem('auth_token');
  },

  async getStoredToken(): Promise<string | null> {
    return AsyncStorage.getItem('auth_token');
  },

  async qrLogin(loginToken: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/qr-login', { token: loginToken });
    await AsyncStorage.setItem('auth_token', data.token);
    return data;
  },

  async getQrToken(): Promise<string> {
    const { data } = await api.get<{ loginToken: string }>('/auth/qr-token');
    return data.loginToken;
  },

  async regenerateQrToken(): Promise<string> {
    const { data } = await api.post<{ loginToken: string }>('/auth/qr-token/regenerate');
    return data.loginToken;
  },
};
