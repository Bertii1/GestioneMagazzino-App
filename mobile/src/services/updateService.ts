import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

export interface VersionInfo {
  version: string;
  minVersion: string;
  downloadUrl: string | null;
  updateAvailable: boolean;
  forceUpdate: boolean;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}

export async function checkForUpdate(apiUrl: string): Promise<VersionInfo | null> {
  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';
  const response = await fetch(`${apiUrl}/api/version?platform=android`);
  if (!response.ok) return null;
  const data = await response.json();
  return {
    version: data.version,
    minVersion: data.minVersion,
    downloadUrl: data.downloadUrl,
    updateAvailable: compareVersions(data.version, currentVersion) > 0,
    forceUpdate: compareVersions(data.minVersion, currentVersion) > 0,
  };
}

export function openDownloadUrl(downloadUrl: string): void {
  Linking.openURL(downloadUrl);
}
