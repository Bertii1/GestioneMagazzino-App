import * as Network from 'expo-network';

const PORT = 3000;
const APP_ID = 'gestione-magazzino';
const TIMEOUT_MS = 600;
const BATCH_SIZE = 30;

async function ping(host: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`http://${host}:${PORT}/health`, { signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json() as Record<string, unknown>;
    return json?.app === APP_ID ? `http://${host}:${PORT}` : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verifica se un URL è raggiungibile e risponde come il nostro server.
 * Timeout 2 secondi (per la verifica dell'URL salvato).
 */
export async function verifyServerUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    if (!res.ok) return false;
    const json = await res.json() as Record<string, unknown>;
    return json?.app === APP_ID;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scansiona la subnet del dispositivo alla ricerca del server.
 * Emette il progresso (0-100) tramite onProgress.
 * Restituisce l'URL base del server (es. "http://192.168.0.240:3000") o null.
 */
export async function discoverServer(
  onProgress?: (pct: number) => void
): Promise<string | null> {
  let ipAddress: string;
  try {
    ipAddress = await Network.getIpAddressAsync();
  } catch {
    return null;
  }

  if (!ipAddress || ipAddress === '0.0.0.0' || ipAddress === '127.0.0.1') {
    return null;
  }

  const parts = ipAddress.split('.');
  if (parts.length !== 4) return null;
  const subnet = parts.slice(0, 3).join('.');

  // IP candidati prioritari (gateway tipici + indirizzi server comuni)
  const ownLast = parseInt(parts[3], 10);
  const priority = [1, 2, 254, 100, 200, 240, 10, 20, 50]
    .filter(n => n !== ownLast)
    .map(n => `${subnet}.${n}`);
  const all = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`)
    .filter(h => h !== ipAddress);
  const rest = all.filter(h => !priority.includes(h));
  const ordered = [...priority, ...rest];

  let scanned = 0;
  for (let i = 0; i < ordered.length; i += BATCH_SIZE) {
    const batch = ordered.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(ping));
    scanned += batch.length;
    onProgress?.(Math.round((scanned / ordered.length) * 100));
    const found = results.find(Boolean);
    if (found) return found;
  }
  return null;
}
