import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Rect, Image as SvgImage, Text as SvgText } from 'react-native-svg';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShelfQR'>;

/** Prefisso schema URL per gli scaffali di questa app */
export const SHELF_QR_PREFIX = 'magazzino://shelf/';

// Dimensioni del PNG esportato
const EXP_W = 300;
const QR_SIZE = 220;
const QR_X = (EXP_W - QR_SIZE) / 2; // 40

export default function ShelfQRScreen({ route, navigation }: Props) {
  const { shelfId, shelfCode, shelfName, warehouseId, level } = route.params;
  const qrValue = `${SHELF_QR_PREFIX}${shelfId}/level/${level}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qrRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compositeRef = useRef<any>(null);

  const [sharing, setSharing] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);

  // Step 2: quando qrBase64 è pronto, esporta il SVG composito
  useEffect(() => {
    if (!qrBase64) return;
    const timer = setTimeout(() => {
      if (!compositeRef.current) {
        setQrBase64(null);
        setSharing(false);
        return;
      }
      compositeRef.current.toDataURL(async (base64: string) => {
        try {
          const safeName = shelfCode.replace(/[^A-Z0-9]/gi, '_');
          const fileName = `QR_Scaffale_${safeName}_R${level}.png`;
          const path = `${FileSystem.cacheDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(path, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const canShare = await Sharing.isAvailableAsync();
          if (!canShare) {
            Alert.alert('Condivisione non disponibile', 'Il tuo dispositivo non supporta la condivisione di file.');
            return;
          }
          await Sharing.shareAsync(path, {
            mimeType: 'image/png',
            dialogTitle: `QR Scaffale ${shelfCode} · Ripiano ${level}`,
          });
        } catch {
          Alert.alert('Errore', 'Impossibile condividere il QR code');
        } finally {
          setQrBase64(null);
          setSharing(false);
        }
      });
    }, 150); // attendi il render del SVG composito
    return () => clearTimeout(timer);
  }, [qrBase64]);

  const handleShare = () => {
    if (!qrRef.current) return;
    setSharing(true);
    // Step 1: cattura il QR come base64 PNG
    qrRef.current.toDataURL((base64: string) => {
      setQrBase64(base64); // attiva useEffect step 2
    });
  };

  // Calcolo altezze layout SVG composito (solo QR + subtext grigio)
  const QR_Y = 20;
  const SUBTEXT_Y = QR_Y + QR_SIZE + 16;  // 256
  const EXP_H = SUBTEXT_Y + 24;            // 280

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>

      {/* ── SVG composito off-screen usato solo per l'esportazione ── */}
      {qrBase64 && (
        <View style={styles.offscreen}>
          <Svg ref={compositeRef} width={EXP_W} height={EXP_H}>
            {/* Sfondo bianco */}
            <Rect width={EXP_W} height={EXP_H} fill="white" />

            {/* QR code */}
            <SvgImage
              href={`data:image/png;base64,${qrBase64}`}
              x={QR_X} y={QR_Y}
              width={QR_SIZE} height={QR_SIZE}
            />

            {/* Testo grigio sotto al QR */}
            <SvgText
              x={150} y={SUBTEXT_Y}
              textAnchor="middle" fontSize={12} fill="#9CA3AF"
            >{`Scaffale ${shelfCode} · Ripiano ${level}`}</SvgText>
          </Svg>
        </View>
      )}

      {/* ── QR visibile a schermo ───────────────────────────────────── */}
      <View style={styles.qrWrapper}>
        <QRCode
          value={qrValue}
          size={220}
          color="#111827"
          backgroundColor="#FFFFFF"
          getRef={(ref) => { qrRef.current = ref; }}
        />
        <Text style={styles.qrSubtext}>
          Scaffale {shelfCode} · Ripiano {level}
        </Text>
      </View>

      <Text style={styles.hint}>
        Stampa e attacca fisicamente questo QR sullo scaffale.{'\n'}
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
            <Text style={styles.btnText}>Condividi / Salva PNG</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },

  // SVG composito off-screen (solo per esportazione)
  offscreen: { position: 'absolute', left: -9999, top: 0 },

  qrWrapper: {
    padding: 16, backgroundColor: '#fff', borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  qrSubtext: {
    marginTop: 10, fontSize: 12, color: '#9CA3AF',
    fontWeight: '500',
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
