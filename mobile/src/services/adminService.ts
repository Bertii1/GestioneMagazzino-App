import api from './api';
import { User } from '../types';

export const adminService = {
  async listUsers(): Promise<User[]> {
    const { data } = await api.get<{ users: User[] }>('/users');
    return data.users;
  },

  async createUser(name: string, email: string, password: string, role: 'admin' | 'operator' = 'operator'): Promise<User> {
    const { data } = await api.post<{ user: User }>('/auth/register', { name, email, password, role });
    return data.user;
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  async resetUserPassword(id: string, newPassword: string): Promise<void> {
    await api.post(`/users/${id}/reset-password`, { newPassword });
  },
};
