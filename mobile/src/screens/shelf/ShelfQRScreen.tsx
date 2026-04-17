import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Barcode from 'react-native-barcode-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShelfQR'>;

/** Prefisso schema URL per gli scaffali di questa app */
export const SHELF_QR_PREFIX = 'magazzino://shelf/';

export default function ShelfQRScreen({ route, navigation }: Props) {
  const { shelfId, shelfCode, warehouseId, level } = route.params;
  const barcodeValue = `${SHELF_QR_PREFIX}${shelfId}/level/${level}`;
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      const html = buildBarcodeHTML(barcodeValue, shelfCode, level);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const safeName = shelfCode.replace(/[^A-Z0-9]/gi, '_');
      const destPath = `${FileSystem.cacheDirectory}Barcode_Scaffale_${safeName}_R${level}.pdf`;
      await FileSystem.moveAsync({ from: uri, to: destPath });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Condivisione non disponibile', 'Il tuo dispositivo non supporta la condivisione di file PDF.');
        return;
      }
      await Sharing.shareAsync(destPath, {
        mimeType: 'application/pdf',
        dialogTitle: `Barcode Scaffale ${shelfCode} · Ripiano ${level}`,
      });
    } catch (err: unknown) {
      const isCancel = (err as { message?: string })?.message?.toLowerCase().includes('cancel');
      if (!isCancel) {
        Alert.alert(
          'Errore generazione PDF',
          'Impossibile generare il PDF. Verifica che il dispositivo sia connesso a internet (necessario per i barcode).',
        );
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.barcodeWrapper}>
        <Barcode
          value={barcodeValue}
          format="CODE128"
          singleBarWidth={1.0}
          height={80}
          lineColor="#111827"
          backgroundColor="#FFFFFF"
        />
        <Text style={styles.barcodeSubtext}>
          Scaffale {shelfCode} · Ripiano {level}
        </Text>
      </View>

      <Text style={styles.hint}>
        Stampa e attacca fisicamente questo barcode sullo scaffale.{'\n'}
        La fotocamera dell'app lo riconoscerà direttamente.
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnShare, sharing && styles.btnDisabled]}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>Condividi / Salva PDF</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnOpen]}
          onPress={() => navigation.replace('ShelfDetail', { shelfId, warehouseId })}
        >
          <Text style={styles.btnText}>Vai allo scaffale</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function buildBarcodeHTML(value: string, shelfCode: string, level: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; background: white;
  }
  .card {
    text-align: center; padding: 20px;
    border: 1px solid #e5e7eb; border-radius: 8px;
    max-width: 200px;
  }
  svg { display: block; margin: 0 auto; max-width: 100%; }
  .label { font-size: 13px; color: #6b7280; margin-top: 10px; }
</style>
</head>
<body>
  <div class="card">
    <svg id="barcode"></svg>
    <p class="label">Scaffale ${shelfCode} · Ripiano ${level}</p>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"
    onerror="document.body.innerHTML='<div style=\\'padding:24px;color:#dc2626;font-family:Arial;font-size:15px\\'>Errore: libreria barcode non disponibile. Verifica la connessione internet e riprova.</div>'"></script>
  <script>
    if (typeof JsBarcode !== 'undefined') {
      JsBarcode('#barcode', ${JSON.stringify(value)}, {
        format: 'CODE128', width: 0.8, height: 40, margin: 6, displayValue: false
      });
    }
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  barcodeWrapper: {
    padding: 20, backgroundColor: '#fff', borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  barcodeSubtext: {
    marginTop: 10, fontSize: 12, color: '#9CA3AF', fontWeight: '500',
  },
  hint: {
    fontSize: 13, color: '#9CA3AF', textAlign: 'center',
    marginTop: 20, lineHeight: 20,
  },
  actions: { width: '100%', maxWidth: 320, marginTop: 24, gap: 12 },
  btn: {
    borderRadius: 10, padding: 16, alignItems: 'center',
    justifyContent: 'center', flexDirection: 'row',
  },
  btnShare: { backgroundColor: '#2563EB' },
  btnOpen: { backgroundColor: '#374151' },
  btnDisabled: { backgroundColor: '#93C5FD' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
