import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { SpeechResultsEvent } from '@react-native-voice/voice';
// Import lazy: @react-native-voice/voice richiede expo-dev-client, non funziona su Expo Go
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Voice: typeof import('@react-native-voice/voice').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Voice = require('@react-native-voice/voice').default;
} catch { /* modulo nativo non disponibile (Expo Go) */ }
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Warehouse, Shelf } from '../../types';
import { productService } from '../../services/productService';
import { warehouseService } from '../../services/warehouseService';
import { shelfService } from '../../services/shelfService';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductForm'>;

const generateInternalCode = (): string =>
  `INT-${Date.now().toString(36).toUpperCase()}`;

/**
 * Costruisce un nome pulito da usare come default nella card lookup.
 * Per l'elettronica: preferisce "Brand Modello" rispetto al titolo verboso del DB.
 */
const buildCleanName = (r: LookupResult): string => {
  if (r.brand && r.model) return `${r.brand} ${r.model}`;
  // Niente modello: tronca il titolo alla prima virgola o parentesi
  return r.name.split(/[,(]/)[0].trim();
};

interface LookupResult {
  name: string;
  brand?: string;
  model?: string;
  color?: string;
  description?: string;
  category?: string;
}

export default function ProductFormScreen({ route, navigation }: Props) {
  const {
    productId,
    shelfId: initialShelfId,
    warehouseId: initialWarehouseId,
    barcode: scannedBarcode,
    level: initialLevel,
  } = route.params ?? {};
  const isEdit = !!productId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupEditName, setLookupEditName] = useState('');

  // Scanner inline
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanHandledRef = useRef(false);

  // Input vocale
  const [listeningField, setListeningField] = useState<string | null>(null);
  const listeningFieldRef = useRef<string | null>(null);

  // Campi prodotto
  const [barcode, setBarcode] = useState(scannedBarcode ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [level, setLevel] = useState(initialLevel ? String(initialLevel) : '1');
  const [slot, setSlot] = useState('');

  // Selezione magazzino/scaffale
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialWarehouseId ?? '');
  const [selectedShelfId, setSelectedShelfId] = useState(initialShelfId ?? '');

  const selectedShelf = shelves.find(s => s._id === selectedShelfId);
  const maxLevels = selectedShelf?.levels ?? 0;

  useEffect(() => {
    warehouseService.getAll().then(setWarehouses).catch(() => null);
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) {
      shelfService.getByWarehouse(selectedWarehouseId).then(setShelves).catch(() => null);
    }
  }, [selectedWarehouseId]);

  useEffect(() => {
    if (isEdit && productId) {
      productService.getById(productId).then((p) => {
        setBarcode(p.barcode);
        setName(p.name);
        setDescription(p.description ?? '');
        setColor(p.color ?? '');
        setQuantity(String(p.quantity));
        setLevel(String(p.level));
        setSlot(p.slot ?? '');
        const wId = typeof p.warehouseId === 'object' ? p.warehouseId._id : p.warehouseId;
        const sId = typeof p.shelfId === 'object' ? p.shelfId._id : p.shelfId;
        setSelectedWarehouseId(wId);
        setSelectedShelfId(sId);
      }).catch(() => Alert.alert('Errore', 'Prodotto non trovato'))
        .finally(() => setLoading(false));
    }
  }, [isEdit, productId]);

  // ── Riconoscimento vocale ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!Voice) return;
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0]?.trim() ?? '';
      if (text) {
        const field = listeningFieldRef.current;
        if (field === 'name') setName(text);
        else if (field === 'color') setColor(text);
        else if (field === 'description') setDescription(prev => prev ? `${prev} ${text}` : text);
        else if (field === 'slot') setSlot(text);
      }
      doStopVoice();
    };
    Voice.onSpeechError = () => doStopVoice();
    return () => { Voice?.destroy().then(() => Voice?.removeAllListeners()); };
  }, []);

  const doStopVoice = async () => {
    try { await Voice?.stop(); } catch {}
    listeningFieldRef.current = null;
    setListeningField(null);
  };

  const startVoice = async (fieldName: string) => {
    if (!Voice) {
      Alert.alert(
        'Voce non disponibile',
        'Il riconoscimento vocale richiede un build nativo dell\'app (expo-dev-client), non funziona con Expo Go.'
      );
      return;
    }
    if (listeningFieldRef.current) {
      await doStopVoice();
      return;
    }
    try {
      listeningFieldRef.current = fieldName;
      setListeningField(fieldName);
      await Voice.start('it-IT');
    } catch {
      listeningFieldRef.current = null;
      setListeningField(null);
      Alert.alert(
        'Voce non disponibile',
        'Il riconoscimento vocale richiede un build nativo dell\'app (expo-dev-client).'
      );
    }
  };

  // ── Lookup barcode su UPC Item DB (elettronica) ──────────────────────────────
  const doLookup = useCallback(async (code: string) => {
    if (!code || code.startsWith('INT-')) return;
    setLooking(true);
    setLookupResult(null);
    try {
      // UPC Item DB — ottima copertura su elettronica audio/video
      const res = await fetch(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${code.trim()}`
      );
      if (res.ok) {
        const json = await res.json();
        const item = json?.items?.[0];
        if (item?.title) {
          const result: LookupResult = {
            name: item.title,
            brand: item.brand || undefined,
            model: item.model || undefined,
            color: item.color || undefined,
            description: item.description || undefined,
            category: item.category || undefined,
          };
          setLookupResult(result);
          setLookupEditName(buildCleanName(result));
          return;
        }
      }
      // Fallback: Open EAN (barcode europei)
      const res2 = await fetch(
        `https://opengtindb.org/?ean=${code.trim()}&cmd=ean&lang=it&tf=json`
      );
      if (res2.ok) {
        const json2 = await res2.json();
        const p = json2?.product?.[0];
        if (p?.name) {
          const result: LookupResult = {
            name: p.name,
            brand: p.vendor || undefined,
            description: p.detailname || undefined,
            category: p.maincategory || undefined,
          };
          setLookupResult(result);
          setLookupEditName(buildCleanName(result));
          return;
        }
      }
      Alert.alert('Non trovato', 'Prodotto non presente nei database online.\nCompila manualmente i campi.');
    } catch {
      Alert.alert('Errore rete', 'Impossibile raggiungere il database prodotti.');
    } finally {
      setLooking(false);
    }
  }, []);

  // Auto-lookup quando il barcode arriva dallo scanner
  useEffect(() => {
    if (scannedBarcode && !scannedBarcode.startsWith('INT-')) {
      doLookup(scannedBarcode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Permesso fotocamera', 'Concedi l\'accesso alla fotocamera nelle impostazioni.');
        return;
      }
    }
    scanHandledRef.current = false;
    setScannerOpen(true);
  };

  const handleInlineScan = ({ data }: { data: string }) => {
    if (scanHandledRef.current) return;
    scanHandledRef.current = true;
    setScannerOpen(false);
    setBarcode(data);
    setLookupResult(null);
    doLookup(data);
  };

  const applyLookup = () => {
    if (!lookupResult) return;
    setName(lookupEditName.trim() || lookupResult.name);
    if (lookupResult.color) setColor(lookupResult.color);
    // Descrizione: titolo completo (se diverso dal nome pulito) + descrizione + categoria
    const parts = [
      lookupResult.description,
      lookupResult.category && `Categoria: ${lookupResult.category}`,
    ].filter(Boolean);
    if (parts.length) setDescription(parts.join('\n'));
    setLookupResult(null);
  };

  // ── Salvataggio ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Errore', 'Il nome del prodotto è obbligatorio');
      return;
    }
    if (!selectedWarehouseId || !selectedShelfId) {
      Alert.alert('Errore', 'Seleziona un magazzino e uno scaffale');
      return;
    }

    const finalBarcode = barcode.trim() || generateInternalCode();

    setSaving(true);
    try {
      const dto = {
        barcode: finalBarcode,
        name: name.trim(),
        description: description.trim() || undefined,
        color: color.trim() || undefined,
        warehouseId: selectedWarehouseId,
        shelfId: selectedShelfId,
        level: parseInt(level, 10) || 1,
        slot: slot.trim() || undefined,
        quantity: parseInt(quantity, 10) || 0,
      };

      if (isEdit && productId) {
        await productService.update(productId, dto);
      } else {
        await productService.create(dto);
      }

      navigation.goBack();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Errore durante il salvataggio';
      Alert.alert('Errore', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Barcode + fotocamera + cerca online ─────────────────────── */}
        <Text style={styles.label}>Barcode</Text>
        <View style={styles.barcodeRow}>
          <TextInput
            style={[styles.input, styles.barcodeInput]}
            value={barcode}
            onChangeText={(v) => { setBarcode(v); setLookupResult(null); }}
            placeholder="Scansiona o digita il codice"
            autoCapitalize="characters"
            editable={!scannedBarcode}
          />
          {!scannedBarcode && (
            <TouchableOpacity style={styles.camBtn} onPress={openScanner}>
              <Ionicons name="camera-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          {barcode && !barcode.startsWith('INT-') && (
            <TouchableOpacity
              style={[styles.lookupBtn, looking && styles.lookupBtnDisabled]}
              onPress={() => doLookup(barcode)}
              disabled={looking}
            >
              {looking
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.lookupBtnText}>Cerca</Text>
              }
            </TouchableOpacity>
          )}
          {!barcode && (
            <TouchableOpacity style={styles.genBtn} onPress={() => setBarcode(generateInternalCode())}>
              <Text style={styles.genBtnText}>Genera</Text>
            </TouchableOpacity>
          )}
          {barcode && !scannedBarcode && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => { setBarcode(''); setLookupResult(null); }}>
              <Ionicons name="close" size={18} color="#DC2626" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Modal scanner inline ─────────────────────────────────────── */}
        <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.scannerCamera}
              facing="back"
              zoom={0}
              onBarcodeScanned={handleInlineScan}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'code39', 'upc_e', 'datamatrix'],
              }}
            >
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFinder} />
                <Text style={styles.scannerHint}>Punta sul codice a barre</Text>
              </View>
            </CameraView>
            <TouchableOpacity style={styles.scannerClose} onPress={() => setScannerOpen(false)}>
              <Text style={styles.scannerCloseText}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* ── Card risultato lookup ────────────────────────────────────── */}
        {lookupResult && (
          <View style={styles.lookupCard}>
            <Text style={styles.lookupTag}>Trovato online — modifica il nome se necessario</Text>
            <TextInput
              style={styles.lookupNameInput}
              value={lookupEditName}
              onChangeText={setLookupEditName}
              selectTextOnFocus
            />
            {lookupResult.brand ? (
              <Text style={styles.lookupBrand}>{lookupResult.brand}</Text>
            ) : null}
            {lookupResult.model ? (
              <Text style={styles.lookupMeta}>Modello: {lookupResult.model}</Text>
            ) : null}
            {lookupResult.color ? (
              <Text style={styles.lookupMeta}>Colore: {lookupResult.color}</Text>
            ) : null}
            {lookupResult.category ? (
              <Text style={styles.lookupMeta}>{lookupResult.category}</Text>
            ) : null}
            {lookupResult.description ? (
              <Text style={styles.lookupDesc} numberOfLines={3}>{lookupResult.description}</Text>
            ) : null}
            <View style={styles.lookupActions}>
              <TouchableOpacity style={styles.lookupApplyBtn} onPress={applyLookup}>
                <Text style={styles.lookupApplyText}>Usa questi dati</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.lookupIgnoreBtn} onPress={() => setLookupResult(null)}>
                <Text style={styles.lookupIgnoreText}>Ignora</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!barcode && (
          <Text style={styles.hint}>
            Senza barcode verrà generato automaticamente un codice interno.
          </Text>
        )}

        <Field label="Nome prodotto *" value={name} onChange={setName} placeholder="Nome del prodotto"
          voiceField="name" listeningField={listeningField} onVoice={startVoice} />
        <Field label="Colore / Finitura" value={color} onChange={setColor} placeholder="Es. Nero, Silver, Champagne"
          voiceField="color" listeningField={listeningField} onVoice={startVoice} />
        <Field label="Descrizione" value={description} onChange={setDescription} placeholder="Opzionale" multiline
          voiceField="description" listeningField={listeningField} onVoice={startVoice} />
        <Field label="Quantità" value={quantity} onChange={setQuantity} placeholder="1" keyboardType="numeric" />

        {/* ── Selezione magazzino ──────────────────────────────────────── */}
        <Text style={styles.label}>Magazzino *</Text>
        {warehouses.length === 0 ? (
          <Text style={styles.emptyChip}>Nessun magazzino disponibile</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {warehouses.map((w) => (
              <TouchableOpacity
                key={w._id}
                style={[styles.chip, selectedWarehouseId === w._id && styles.chipActive]}
                onPress={() => { setSelectedWarehouseId(w._id); setSelectedShelfId(''); }}
              >
                <Text style={[styles.chipText, selectedWarehouseId === w._id && styles.chipTextActive]}>
                  {w.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Selezione scaffale ───────────────────────────────────────── */}
        {selectedWarehouseId && (
          <>
            <Text style={styles.label}>Scaffale *</Text>
            {shelves.length === 0 ? (
              <Text style={styles.emptyChip}>Nessuno scaffale in questo magazzino</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {shelves.map((s) => (
                  <TouchableOpacity
                    key={s._id}
                    style={[styles.chip, selectedShelfId === s._id && styles.chipActive]}
                    onPress={() => { setSelectedShelfId(s._id); setLevel('1'); }}
                  >
                    <Text style={[styles.chipText, selectedShelfId === s._id && styles.chipTextActive]}>
                      {s.code}{s.name ? ` · ${s.name}` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* ── Selezione ripiano a pulsanti ─────────────────────────────── */}
        {selectedShelfId && maxLevels > 0 && (
          <>
            <Text style={styles.label}>Ripiano *</Text>
            <View style={styles.levelRow}>
              {Array.from({ length: maxLevels }, (_, i) => i + 1).map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.levelBtn, level === String(l) && styles.levelBtnActive]}
                  onPress={() => setLevel(String(l))}
                >
                  <Text style={[styles.levelBtnText, level === String(l) && styles.levelBtnTextActive]}>
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              Ogni ripiano può contenere più prodotti.
            </Text>
          </>
        )}

        <Field label="Slot / Posizione sul ripiano" value={slot} onChange={setSlot} placeholder="Es. L1, C2 (opzionale)"
          voiceField="slot" listeningField={listeningField} onVoice={startVoice} />

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Salvataggio...' : isEdit ? 'Aggiorna' : 'Aggiungi prodotto'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChange, placeholder, multiline, keyboardType,
  voiceField, listeningField, onVoice,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  voiceField?: string;
  listeningField?: string | null;
  onVoice?: (field: string) => void;
}) {
  const isListening = !!voiceField && listeningField === voiceField;
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          style={[styles.input, styles.fieldInput, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          multiline={multiline}
          keyboardType={keyboardType ?? 'default'}
        />
        {voiceField && onVoice && (
          <TouchableOpacity
            style={[styles.micBtn, isListening && styles.micBtnActive]}
            onPress={() => onVoice(voiceField)}
          >
            <Ionicons name={isListening ? 'stop-circle-outline' : 'mic-outline'} size={20} color={isListening ? '#DC2626' : '#374151'} />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: '#fff',
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  // Barcode row
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barcodeInput: { flex: 1 },
  camBtn: {
    backgroundColor: '#1D4ED8', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 11, alignItems: 'center', justifyContent: 'center',
  },
  camBtnText: { fontSize: 18 },
  lookupBtn: {
    backgroundColor: '#2563EB', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 13, minWidth: 58, alignItems: 'center',
  },
  lookupBtnDisabled: { backgroundColor: '#93C5FD' },
  lookupBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  genBtn: {
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13,
  },
  genBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  clearBtn: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 13 },
  clearBtnText: { color: '#DC2626', fontWeight: '600' },

  // Lookup result card
  lookupCard: {
    marginTop: 10, backgroundColor: '#EFF6FF',
    borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 10, padding: 14,
  },
  lookupTag: {
    fontSize: 11, fontWeight: '700', color: '#2563EB',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  lookupNameInput: {
    fontSize: 15, fontWeight: '700', color: '#111827',
    borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#fff',
    marginBottom: 4,
  },
  lookupBrand: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 2 },
  lookupMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  lookupDesc: { fontSize: 13, color: '#374151', marginTop: 6, lineHeight: 18 },
  lookupActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  lookupApplyBtn: {
    flex: 1, backgroundColor: '#2563EB', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  lookupApplyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  lookupIgnoreBtn: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  lookupIgnoreText: { color: '#374151', fontWeight: '600', fontSize: 13 },

  // Level picker
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  levelBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: '#D1D5DB',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  levelBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  levelBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  levelBtnTextActive: { color: '#fff' },

  // Scanner modal
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerCamera: { flex: 1 },
  scannerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  scannerFinder: {
    width: 260, height: 140, borderRadius: 12,
    borderWidth: 2, borderColor: '#2563EB', backgroundColor: 'transparent',
  },
  scannerHint: {
    color: '#fff', fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  scannerClose: {
    backgroundColor: '#1F2937', padding: 18, alignItems: 'center',
  },
  scannerCloseText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Field con microfono
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  fieldInput: { flex: 1 },
  micBtn: {
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 11, paddingVertical: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: '#FEE2E2', borderColor: '#DC2626' },
  micBtnText: { fontSize: 18 },

  hint: { fontSize: 12, color: '#9CA3AF', marginTop: 6, marginBottom: 4 },
  chipScroll: { marginBottom: 4 },
  chip: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  emptyChip: { fontSize: 13, color: '#9CA3AF', marginBottom: 8 },
  saveBtn: { backgroundColor: '#2563EB', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { backgroundColor: '#93C5FD' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
