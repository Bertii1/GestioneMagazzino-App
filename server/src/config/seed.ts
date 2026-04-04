import User from '../models/User';
import { env } from './env';
import { logger } from './logger';

/**
 * Crea l'utente admin se non esiste nessun admin nel database.
 * Chiamato una volta all'avvio del server.
 */
export async function seedAdmin(): Promise<void> {
  const adminExists = await User.findOne({ role: 'admin' });
  if (adminExists) return;

  await User.create({
    name: 'Amministratore',
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    role: 'admin',
    mustChangePassword: true,
  });

  logger.info(
    { email: env.ADMIN_EMAIL },
    'Account admin creato — cambia la password al primo accesso'
  );
}
