import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Chiamato da serverStore non appena il server viene trovato o verificato.
 * serverUrl è la base del server, es. "http://192.168.0.240:3000"
 */
export function setServerUrl(serverUrl: string) {
  api.defaults.baseURL = `${serverUrl}/api`;
}

// Interceptor: aggiungi JWT ad ogni richiesta
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: gestione errori globale
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token');
    }
    return Promise.reject(error);
  }
);

export default api;
