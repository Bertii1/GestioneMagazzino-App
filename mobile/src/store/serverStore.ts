import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { discoverServer, verifyServerUrl } from '../services/serverDiscovery';
import { setServerUrl } from '../services/api';

const STORAGE_KEY = 'server_url';

interface ServerState {
  /** URL base del server, es. "http://192.168.0.240:3000" */
  serverUrl: string | null;
  /** true mentre è in corso la scansione di rete */
  isDiscovering: boolean;
  /** percentuale di avanzamento della scansione subnet (0-100) */
  progress: number;

  /** Avvia il discovery: prima verifica URL salvato, poi scansiona */
  discover: () => Promise<void>;
  /** Imposta manualmente l'URL e lo verifica; ritorna true se raggiungibile */
  setManualUrl: (url: string) => Promise<boolean>;
  /** Cancella l'URL salvato e forza un nuovo discovery */
  reset: () => Promise<void>;
}

export const useServerStore = create<ServerState>((set, get) => ({
  serverUrl: null,
  isDiscovering: true,   // parte subito in discovering, discover() viene chiamato al mount
  progress: 0,

  discover: async () => {
    set({ isDiscovering: true, progress: 0 });

    // 1. Verifica URL precedentemente salvato (rapido, 2s timeout)
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const ok = await verifyServerUrl(stored);
      if (ok) {
        setServerUrl(stored);
        set({ serverUrl: stored, isDiscovering: false });
        return;
      }
      // URL salvato non raggiungibile → rimuovi e riscan
      await AsyncStorage.removeItem(STORAGE_KEY);
    }

    // 2. Scansione subnet
    const found = await discoverServer((pct) => set({ progress: pct }));
    if (found) {
      await AsyncStorage.setItem(STORAGE_KEY, found);
      setServerUrl(found);
      set({ serverUrl: found, isDiscovering: false });
    } else {
      set({ isDiscovering: false });
    }
  },

  setManualUrl: async (raw: string) => {
    // Normalizza: aggiungi http:// se mancante, rimuovi trailing slash
    let url = raw.trim().replace(/\/$/, '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }
    // Se non c'è la porta, aggiungi :3000
    const hasPort = /:\d+$/.test(url.replace(/^https?:\/\//, '').split('/')[0]);
    if (!hasPort) url = `${url}:3000`;

    const ok = await verifyServerUrl(url);
    if (ok) {
      await AsyncStorage.setItem(STORAGE_KEY, url);
      setServerUrl(url);
      set({ serverUrl: url });
    }
    return ok;
  },

  reset: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ serverUrl: null });
    get().discover();
  },
}));
