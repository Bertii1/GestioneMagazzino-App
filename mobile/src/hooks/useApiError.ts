import { Alert } from 'react-native';

type ApiErrorShape = {
  response?: { data?: { message?: string } };
  message?: string;
};

/**
 * Mostra un Alert con il messaggio di errore dell'API,
 * o il messaggio di default se l'errore non ha una struttura attesa.
 */
export function handleApiError(err: unknown, defaultMessage: string): void {
  const e = err as ApiErrorShape;
  const msg = e?.response?.data?.message || e?.message || defaultMessage;
  Alert.alert('Errore', msg);
}
