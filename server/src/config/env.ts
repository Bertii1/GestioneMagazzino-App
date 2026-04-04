/**
 * Validazione e accesso centralizzato alle variabili d'ambiente.
 * Importare questo modulo garantisce che tutte le env obbligatorie siano presenti.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabile d'ambiente obbligatoria mancante: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '3000'), 10),
  MONGODB_URI: required('MONGODB_URI'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),
  WHISPER_URL: optional('WHISPER_URL', 'http://whisper-asr:9000'),
  CORS_ORIGIN: optional('CORS_ORIGIN', '*'),
  ADMIN_EMAIL: optional('ADMIN_EMAIL', 'admin@magazzino.local'),
  ADMIN_PASSWORD: optional('ADMIN_PASSWORD', 'admin123'),
} as const;

export const isProd = env.NODE_ENV === 'production';
