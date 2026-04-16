import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator, View, Text, TextInput,
  TouchableOpacity, StyleSheet, Alert,
} from 'react-native';

import { useAuthStore } from '../store/authStore';
import { useServerStore } from '../store/serverStore';
import { useUpdateChecker } from '../hooks/useUpdateChecker';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import { useNavigation, NavigationProp } from '@react-navigation/native';

import LoginScreen from '../screens/auth/LoginScreen';
import ChangePasswordScreen from '../screens/auth/ChangePasswordScreen';
import MyQRCodeScreen from '../screens/auth/MyQRCodeScreen';

import AdminPanelScreen from '../screens/admin/AdminPanelScreen';

import WarehouseListScreen from '../screens/warehouse/WarehouseListScreen';
import WarehouseMapScreen from '../screens/warehouse/WarehouseMapScreen';

import ShelfDetailScreen from '../screens/shelf/ShelfDetailScreen';
import ShelfQRScreen from '../screens/shelf/ShelfQRScreen';
import BatchQRPrintScreen from '../screens/shelf/BatchQRPrintScreen';

import ProductListScreen from '../screens/product/ProductListScreen';
import ProductDetailScreen from '../screens/product/ProductDetailScreen';
import ProductFormScreen from '../screens/product/ProductFormScreen';
import ScanBarcodeScreen from '../screens/product/ScanBarcodeScreen';

type TabParamList = { Magazzini: undefined; Prodotti: undefined; Admin: undefined };

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function HeaderButtons() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const logout = useAuthStore((s) => s.logout);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <TouchableOpacity
        onPress={() => nav.navigate('MyQRCode')}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="qr-code-outline" size={22} color="#374151" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={logout}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="log-out-outline" size={22} color="#DC2626" />
      </TouchableOpacity>
    </View>
  );
}

function MainTabs() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#6B7280',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Magazzini"
        component={WarehouseListScreen as React.ComponentType}
        options={{
          tabBarLabel: 'Magazzini',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Prodotti"
        component={ProductListScreen as React.ComponentType}
        options={{
          tabBarLabel: 'Prodotti',
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetags-outline" size={size} color={color} />,
        }}
      />
      {isAdmin && (
        <Tab.Screen
          name="Admin"
          component={AdminPanelScreen as React.ComponentType}
          options={{
            tabBarLabel: 'Admin',
            tabBarIcon: ({ color, size }) => <Ionicons name="shield-outline" size={size} color={color} />,
          }}
        />
      )}
    </Tab.Navigator>
  );
}

// ── Schermata configurazione manuale server ───────────────────────────────────

function ServerSetupScreen({
  onConnect, onRetry, isRetrying,
}: {
  onConnect: (url: string) => Promise<boolean>;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const [useHttps, setUseHttps] = useState(true);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    const h = host.trim();
    if (!h) { Alert.alert('Inserisci l\'indirizzo del server'); return; }
    setConnecting(true);
    const scheme = useHttps ? 'https' : 'http';
    const p = port.trim();
    const defaultPort = useHttps ? '443' : '3000';
    const portSuffix = p && p !== defaultPort ? `:${p}` : (useHttps ? '' : ':3000');
    const url = `${scheme}://${h}${portSuffix}`;
    const ok = await onConnect(url);
    setConnecting(false);
    if (!ok) {
      Alert.alert(
        'Server non raggiungibile',
        `Impossibile connettersi a ${url}.\nVerifica che il server sia avviato e raggiungibile.`
      );
    }
  };

  return (
    <View style={ss.container}>
      <View style={ss.card}>
        <Ionicons name="warning" size={40} color="#F59E0B" style={{ textAlign: 'center', marginBottom: 12 }} />
        <Text style={ss.title}>Server non trovato</Text>
        <Text style={ss.subtitle}>
          Il server non è stato rilevato automaticamente.{'\n'}
          Inserisci l'indirizzo manualmente.
        </Text>

        <View style={{ flexDirection: 'row', marginBottom: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#D1D5DB' }}>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 10, backgroundColor: useHttps ? '#2563EB' : '#F3F4F6', alignItems: 'center' }}
            onPress={() => { setUseHttps(true); setPort(''); }}
          >
            <Text style={{ fontWeight: '600', color: useHttps ? '#fff' : '#6B7280' }}>HTTPS (Cloud)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 10, backgroundColor: !useHttps ? '#2563EB' : '#F3F4F6', alignItems: 'center' }}
            onPress={() => { setUseHttps(false); setPort('3000'); }}
          >
            <Text style={{ fontWeight: '600', color: !useHttps ? '#fff' : '#6B7280' }}>HTTP (LAN)</Text>
          </TouchableOpacity>
        </View>

        <Text style={ss.label}>{useHttps ? 'Dominio o IP del server' : 'Indirizzo IP del server'}</Text>
        <TextInput
          style={ss.input}
          value={host}
          onChangeText={v => setHost(v.replace(/,/g, '.'))}
          placeholder={useHttps ? 'Es. YOUR_SERVER_URL' : 'Es. 192.168.0.240'}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {!useHttps && (
          <>
            <Text style={ss.label}>Porta</Text>
            <TextInput
              style={ss.input}
              value={port}
              onChangeText={setPort}
              placeholder="3000"
              keyboardType="number-pad"
            />
          </>
        )}

        <TouchableOpacity
          style={[ss.btn, ss.btnPrimary, connecting && ss.btnDisabled]}
          onPress={handleConnect}
          disabled={connecting}
        >
          <Text style={ss.btnTextPrimary}>
            {connecting ? 'Connessione...' : 'Connetti'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[ss.btn, ss.btnSecondary, isRetrying && ss.btnDisabled]}
          onPress={onRetry}
          disabled={isRetrying}
        >
          <Text style={ss.btnTextSecondary}>
            {isRetrying ? 'Ricerca in corso...' : 'Riscan rete'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  icon: { fontSize: 40, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: '#F9FAFB',
  },
  btn: { borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  btnPrimary: { backgroundColor: '#2563EB' },
  btnSecondary: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  btnDisabled: { opacity: 0.5 },
  btnTextPrimary: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnTextSecondary: { color: '#374151', fontWeight: '600', fontSize: 15 },
});

// ── Navigator principale ──────────────────────────────────────────────────────

export default function AppNavigator() {
  const { serverUrl, isDiscovering, progress, discover, setManualUrl } = useServerStore();
  const { isAuthenticated, isLoading, restoreSession, mustChangePassword } = useAuthStore();
  const { checking: checkingUpdates, updating } = useUpdateChecker(serverUrl);
  const [retrying, setRetrying] = useState(false);

  // Fase 1: trova il server all'avvio
  useEffect(() => {
    discover();
  }, []);

  // Fase 2: ripristina la sessione auth solo dopo aver trovato il server
  useEffect(() => {
    if (serverUrl) {
      restoreSession();
    }
  }, [serverUrl]);

  // Discovery in corso
  if (isDiscovering) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '600', color: '#374151' }}>
          Ricerca server in corso...
        </Text>
        {progress > 0 && (
          <Text style={{ marginTop: 8, fontSize: 13, color: '#9CA3AF' }}>{progress}%</Text>
        )}
      </View>
    );
  }

  // Server non trovato → input manuale
  if (!serverUrl) {
    return (
      <ServerSetupScreen
        onConnect={setManualUrl}
        onRetry={async () => {
          setRetrying(true);
          await discover();
          setRetrying(false);
        }}
        isRetrying={retrying || isDiscovering}
      />
    );
  }

  // Update check / auth loading
  if (updating || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#2563EB" />
        {updating && (
          <Text style={{ marginTop: 16, fontSize: 14, color: '#6B7280' }}>
            Scaricamento aggiornamento...
          </Text>
        )}
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : mustChangePassword ? (
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
            options={{ title: 'Cambia Password', headerBackVisible: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{
                headerShown: true,
                title: 'Gestione Magazzino',
                headerRight: () => <HeaderButtons />,
              }}
            />
            <Stack.Screen
              name="WarehouseMap"
              component={WarehouseMapScreen}
              options={({ route, navigation }) => ({
                title: route.params.warehouseName,
                headerRight: () => (
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('BatchQRPrint', {
                        warehouseId: route.params.warehouseId,
                        warehouseName: route.params.warehouseName,
                      })
                    }
                    style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="print-outline" size={22} color="#374151" />
                  </TouchableOpacity>
                ),
              })}
            />
            <Stack.Screen name="ShelfDetail" component={ShelfDetailScreen} options={{ title: 'Scaffale' }} />
            <Stack.Screen
              name="ShelfQR"
              component={ShelfQRScreen}
              options={({ route }) => ({ title: `QR · ${route.params.shelfCode} · R${route.params.level}` })}
            />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Dettaglio Prodotto' }} />
            <Stack.Screen
              name="ProductForm"
              component={ProductFormScreen}
              options={({ route }) => ({
                title: route.params?.productId ? 'Modifica Prodotto' : 'Nuovo Prodotto',
              })}
            />
            <Stack.Screen name="ScanBarcode" component={ScanBarcodeScreen} options={{ title: 'Scansiona' }} />
            <Stack.Screen
              name="BatchQRPrint"
              component={BatchQRPrintScreen}
              options={({ route }) => ({ title: `Stampa QR · ${route.params.warehouseName}` })}
            />
            <Stack.Screen name="MyQRCode" component={MyQRCodeScreen} options={{ title: 'Il tuo QR code' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
