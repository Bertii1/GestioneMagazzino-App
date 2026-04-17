import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

export default function ChangePasswordScreen({ navigation }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const clearMustChangePassword = useAuthStore((s) => s.clearMustChangePassword);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Errore', 'La nuova password deve avere almeno 6 caratteri');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Errore', 'Le password non coincidono');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Errore', 'La nuova password deve essere diversa dalla precedente');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      clearMustChangePassword();
      Alert.alert('Fatto', 'Password aggiornata con successo');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Errore durante il cambio password';
      Alert.alert('Errore', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Per la tua sicurezza, devi cambiare la password prima di continuare.
          </Text>
        </View>

        <Text style={styles.title}>Cambia Password</Text>

        <Text style={styles.label}>Password attuale</Text>
        <TextInput
          style={styles.input}
          placeholder="Password attuale"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />

        <Text style={styles.label}>Nuova password</Text>
        <TextInput
          style={styles.input}
          placeholder="Minimo 6 caratteri"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />

        <Text style={styles.label}>Conferma nuova password</Text>
        <TextInput
          style={styles.input}
          placeholder="Ripeti la nuova password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Aggiornamento...' : 'Cambia Password'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  banner: {
    backgroundColor: '#FEF3C7', borderRadius: 10,
    borderLeftWidth: 4, borderLeftColor: '#F59E0B',
    padding: 14, marginBottom: 24,
  },
  bannerText: { color: '#92400E', fontSize: 14, lineHeight: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    padding: 14, fontSize: 16, backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#2563EB', borderRadius: 8, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: { backgroundColor: '#93C5FD' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
