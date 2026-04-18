import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { productService } from '../../services/productService';
import { shelfService } from '../../services/shelfService';
import { SHELF_QR_PREFIX, SHELF_QR_PREFIX_LEGACY } from '../shelf/ShelfQRScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanBarcode'>;

export default function ScanBarcodeScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [checking, setChecking] = useState(false);
  const [statusText, setStatusText] = useState('Punta la fotocamera sul codice');
  const scanningRef = useRef(false);

  const resetScan = () => {
    scanningRef.current = false;
    setScanned(false);
    setChecking(false);
    setStatusText('Punta la fotocamera sul codice');
  };

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Permesso fotocamera necessario</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Concedi accesso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanned(true);
    setChecking(true);

    // ── QR Ripiano ───────────────────────────────────────────────────────────
    const isShelf = data.startsWith(SHELF_QR_PREFIX) || data.startsWith(SHELF_QR_PREFIX_LEGACY);
    if (isShelf) {
      const prefix = data.startsWith(SHELF_QR_PREFIX) ? SHELF_QR_PREFIX : SHELF_QR_PREFIX_LEGACY;
      const rest = data.slice(prefix.length);
      // Formato nuovo: {shelfId}:{n} — legacy: {shelfId}/level/{n} — fallback: solo {shelfId}
      const newMatch = rest.match(/^(.+):(\d+)$/);
      const legacyMatch = rest.match(/^(.+)\/level\/(\d+)$/);
      const match = newMatch ?? legacyMatch;
      const shelfId = match ? match[1] : rest;
      const level = match ? parseInt(match[2], 10) : undefined;

      setStatusText('Apertura ripiano...');
      try {
        const shelf = await shelfService.getById(shelfId);
        const warehouseId =
          typeof shelf.warehouseId === 'object'
            ? shelf.warehouseId._id
            : shelf.warehouseId;

        if (level !== undefined) {
          // QR ripiano → ShelfDetail aperto sul ripiano specifico
          navigation.replace('ShelfDetail', { shelfId, warehouseId, levelFocus: level });
        } else {
          // QR vecchio formato → ShelfDetail senza focus
          navigation.replace('ShelfDetail', { shelfId, warehouseId });
        }
      } catch {
        Alert.alert('Errore', 'Scaffale non trovato o non accessibile.', [
          { text: 'OK', onPress: resetScan },
        ]);
      } finally {
        setChecking(false);
      }
      return;
    }

    // ── Barcode prodotto ─────────────────────────────────────────────────────
    setStatusText('Ricerca prodotto...');
    try {
      const product = await productService.getByBarcode(data);
      setChecking(false);
      // Prodotto trovato → menu azioni
      Alert.alert(
        product.name,
        `Barcode: ${data}`,
        [
          {
            text: 'Modifica',
            onPress: () => navigation.replace('ProductForm', { productId: product._id }),
          },
          {
            text: 'Elimina',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Elimina prodotto',
                `Eliminare "${product.name}"?`,
                [
                  { text: 'Annulla', style: 'cancel', onPress: resetScan },
                  {
                    text: 'Elimina', style: 'destructive',
                    onPress: async () => {
                      try {
                        await productService.delete(product._id);
                        setStatusText('Prodotto eliminato');
                        setTimeout(resetScan, 1200);
                      } catch {
                        Alert.alert('Errore', 'Impossibile eliminare il prodotto');
                        resetScan();
                      }
                    },
                  },
                ]
              );
            },
          },
          { text: 'Chiudi', style: 'cancel', onPress: resetScan },
        ]
      );
    } catch {
      setChecking(false);
      Alert.alert(
        'Prodotto non trovato',
        `Barcode: ${data}\n\nVuoi aggiungere un nuovo prodotto?`,
        [
          { text: 'Annulla', style: 'cancel', onPress: resetScan },
          { text: 'Aggiungi', onPress: () => navigation.replace('ProductForm', { barcode: data }) },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        zoom={0}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'code39', 'upc_e', 'datamatrix'],
        }}
      >
        {/* Overlay mirino */}
        <View style={styles.overlay}>
          <View style={styles.finder} />
        </View>

        {/* Hint dinamico */}
        <View style={styles.hintRow}>
          {checking && <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />}
          <Text style={styles.hintText}>{statusText}</Text>
        </View>
      </CameraView>

      {/* Legenda */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>
          Riconosce: barcode prodotti · QR scaffali
        </Text>
      </View>

      {scanned && !checking && (
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={resetScan}
        >
          <Text style={styles.resetBtnText}>Scansiona di nuovo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  finder: {
    width: 260, height: 160, borderRadius: 12,
    borderWidth: 2, borderColor: '#2563EB',
    backgroundColor: 'transparent',
  },
  hintRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  hintText: {
    color: '#fff', fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  legend: {
    backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 10, alignItems: 'center',
  },
  legendText: { color: '#9CA3AF', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  permText: { fontSize: 16, color: '#374151', marginBottom: 16, textAlign: 'center' },
  permBtn: { backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: '#fff', fontWeight: '600' },
  resetBtn: { backgroundColor: '#2563EB', margin: 20, borderRadius: 8, padding: 14, alignItems: 'center' },
  resetBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
