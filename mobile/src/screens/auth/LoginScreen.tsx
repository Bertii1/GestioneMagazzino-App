import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const QR_PREFIX = 'magazzino://login/';

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanHandled = useRef(false);

  const login = useAuthStore((s) => s.login);
  const loginWithQr = useAuthStore((s) => s.loginWithQr);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Errore', 'Inserisci email e password');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Credenziali non valide';
      Alert.alert('Accesso fallito', message);
    } finally {
      setLoading(false);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permesso negato', 'Concedi l\'accesso alla fotocamera nelle impostazioni.');
        return;
      }
    }
    scanHandled.current = false;
    setScannerOpen(true);
  };

  const handleBarcodeScan = async ({ data }: { data: string }) => {
    if (scanHandled.current) return;
    if (!data.startsWith(QR_PREFIX)) return;
    scanHandled.current = true;
    setScannerOpen(false);
    const loginToken = data.slice(QR_PREFIX.length);
    try {
      await loginWithQr(loginToken);
    } catch {
      Alert.alert('QR non valido', 'Il codice QR non è riconosciuto o è scaduto.');
      scanHandled.current = false;
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Gestione Magazzino</Text>
          <Text style={styles.subtitle}>Accedi al tuo account</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Accesso...' : 'Accedi'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.qrButton} onPress={openScanner}>
            <Ionicons name="qr-code-outline" size={18} color="#2563EB" />
            <Text style={styles.qrButtonText}>Accedi con QR code</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>Non hai un account? Registrati</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal scanner QR */}
      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScan}
          />

          {/* Mirino */}
          <View style={styles.overlay}>
            <View style={styles.viewfinder} />
            <Text style={styles.scanHint}>Punta il QR code personale</Text>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={() => setScannerOpen(false)}>
            <Text style={styles.closeBtnText}>Annulla</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 32 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    padding: 14, fontSize: 16, backgroundColor: '#fff', marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563EB', borderRadius: 8, padding: 16,
    alignItems: 'center', marginBottom: 12,
  },
  buttonDisabled: { backgroundColor: '#93C5FD' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qrButton: {
    borderWidth: 1.5, borderColor: '#2563EB', borderRadius: 8, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 20,
  },
  qrButtonText: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  link: { color: '#2563EB', textAlign: 'center', fontSize: 14 },

  // Scanner
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  viewfinder: {
    width: 240, height: 240,
    borderWidth: 2, borderColor: '#2563EB', borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanHint: {
    marginTop: 20, color: '#fff', fontSize: 15,
    fontWeight: '600', textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute', bottom: 48, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 24,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
