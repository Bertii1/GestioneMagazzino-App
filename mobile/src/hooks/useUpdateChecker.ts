import { useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import api from '../services/api';

/** Confronto semver semplice: ritorna true se current < required */
function isVersionOlder(current: string, required: string): boolean {
  const c = current.split('.').map(Number);
  const r = required.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((c[i] ?? 0) < (r[i] ?? 0)) return true;
    if ((c[i] ?? 0) > (r[i] ?? 0)) return false;
  }
  return false;
}

interface UpdateState {
  checking: boolean;
  updating: boolean;
}

export function useUpdateChecker(serverUrl: string | null): UpdateState {
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!serverUrl) return;
    checkForUpdates();
  }, [serverUrl]);

  async function checkForUpdates() {
    setChecking(true);
    try {
      // 1. Check OTA updates (expo-updates)
      await checkOTA();
      // 2. Check minimum version from server
      await checkMinVersion();
    } finally {
      setChecking(false);
    }
  }

  async function checkOTA() {
    if (__DEV__) return; // OTA non funziona in dev mode
    try {
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) return;

      setUpdating(true);
      await Updates.fetchUpdateAsync();

      Alert.alert(
        'Aggiornamento disponibile',
        'È stato scaricato un aggiornamento. Riavviare l\'app per applicarlo.',
        [
          { text: 'Più tardi', style: 'cancel' },
          {
            text: 'Riavvia ora',
            onPress: () => Updates.reloadAsync(),
          },
        ],
      );
    } catch {
      // OTA check fallito — non bloccare l'app
    } finally {
      setUpdating(false);
    }
  }

  async function checkMinVersion() {
    try {
      const { data } = await api.get<{
        minAppVersion?: string;
      }>('/health');

      const minVersion = data.minAppVersion;
      if (!minVersion) return;

      const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
      if (!isVersionOlder(currentVersion, minVersion)) return;

      // Versione troppo vecchia — mostra alert bloccante
      const easProjectUrl = 'https://expo.dev/accounts/3n3rgy07/projects/gestione-magazzino/builds';

      Alert.alert(
        'Aggiornamento obbligatorio',
        `La versione corrente (${currentVersion}) non è più supportata.\n` +
        `Scarica la versione ${minVersion} o successiva.`,
        [
          {
            text: 'Scarica aggiornamento',
            onPress: () => {
              Linking.openURL(
                Platform.OS === 'ios'
                  ? easProjectUrl // no store, distribuzione interna
                  : easProjectUrl,
              );
            },
          },
        ],
        { cancelable: false },
      );
    } catch {
      // Server non raggiungibile — non bloccare l'avvio
    }
  }

  return { checking, updating };
}
