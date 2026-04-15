import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import api from '../../services/api';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Warehouse, Shelf, ProductCondition } from '../../types';
import { productService } from '../../services/productService';
import { warehouseService } from '../../services/warehouseService';
import { shelfService } from '../../services/shelfService';
import { getServerUrl } from '../../services/api';
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

  // Riconoscimento AI da foto
  const [aiIdentifying, setAiIdentifying] = useState(false);
  const [aiPreviewUri, setAiPreviewUri] = useState<string | null>(null);

  // Input vocale (Whisper)
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [listeningField, setListeningField] = useState<string | null>(null);
  const listeningFieldRef = useRef<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Campi prodotto
  const [barcode, setBarcode] = useState(scannedBarcode ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [brand, setBrand] = useState('');
  const [brands, setBrands] = useState<string[]>([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState<ProductCondition>('nuovo');
  const [level, setLevel] = useState(initialLevel ? String(initialLevel) : '1');
  const [slot, setSlot] = useState('');

  // Foto prodotto (solo in modifica)
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Selezione magazzino/scaffale
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialWarehouseId ?? '');
  const [selectedShelfId, setSelectedShelfId] = useState(initialShelfId ?? '');

  const selectedShelf = shelves.find(s => s._id === selectedShelfId);
  const maxLevels = selectedShelf?.levels ?? 0;

  useEffect(() => {
    warehouseService.getAll().then(setWarehouses).catch(() => null);
    productService.getBrands().then(setBrands).catch(() => null);
    productService.getCategories().then(setCategories).catch(() => null);
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
        setBrand(p.brand ?? '');
        setCategory(p.category ?? '');
        setCondition(p.condition ?? 'nuovo');
        setPhotos(p.photos ?? []);
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

  // ── Riconoscimento vocale (Whisper open-weight via server) ───────────────────
  const applyTranscription = (text: string) => {
    const field = listeningFieldRef.current;
    if (field === 'name') setName(text);
    else if (field === 'color') setColor(text);
    else if (field === 'description') setDescription(prev => prev ? `${prev} ${text}` : text);
    else if (field === 'slot') setSlot(text);
  };

  const startVoice = async (fieldName: string) => {
    // Se sta già registrando → ferma e trascrive
    if (voiceState === 'recording') {
      await stopAndTranscribe();
      return;
    }
    if (voiceState === 'transcribing') return;

    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permesso microfono', 'Concedi accesso al microfono nelle impostazioni.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      listeningFieldRef.current = fieldName;
      setListeningField(fieldName);
      setVoiceState('recording');
    } catch {
      Alert.alert('Errore', 'Impossibile avviare la registrazione.');
    }
  };

  const stopAndTranscribe = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    setVoiceState('transcribing');
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      recordingRef.current = null;
      const uri = rec.getURI();
      if (!uri) throw new Error('URI non disponibile');

      const ext = uri.split('.').pop() ?? 'm4a';
      const formData = new FormData();
      formData.append('audio', { uri, type: `audio/${ext}`, name: `rec.${ext}` } as unknown as Blob);

      const { data } = await api.post<{ text: string }>('/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000,
      });
      const text = data.text?.trim() ?? '';
      if (text) applyTranscription(text);
    } catch {
      Alert.alert('Errore trascrizione', 'Impossibile trascrivere l\'audio. Verifica che il server sia raggiungibile.');
    } finally {
      listeningFieldRef.current = null;
      setListeningField(null);
      setVoiceState('idle');
    }
  };

  // ── Lookup barcode — chain: catalogo interno → UPC Item DB → Barcode Lookup → UPC Database ─────
  const tryInternalCatalog = async (code: string): Promise<LookupResult | null> => {
    const entry = await productService.lookupCatalog(code);
    if (!entry?.name) return null;
    return {
      name: entry.name,
      brand: entry.brand || undefined,
      color: entry.color || undefined,
      description: entry.description || undefined,
      category: entry.category || undefined,
    };
  };

  const tryUpcItemDb = async (code: string): Promise<LookupResult | null> => {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
    if (res.status === 429) return null;
    if (!res.ok) return null;
    const json = await res.json();
    const item = json?.items?.[0];
    if (!item?.title) return null;
    return {
      name: item.title,
      brand: item.brand || undefined,
      model: item.model || undefined,
      color: item.color || undefined,
      description: item.description || undefined,
      category: item.category || undefined,
    };
  };

  const tryBarcodeLookup = async (code: string): Promise<LookupResult | null> => {
    const res = await fetch(`https://www.ean-search.org/api?op=barcode-lookup&ean=${code}&format=json`);
    if (!res.ok) return null;
    const json = await res.json();
    const items = Array.isArray(json) ? json : [json];
    const item = items[0];
    if (!item?.name) return null;
    return {
      name: item.name,
      category: item.categoryName || item.issuingCountry || undefined,
    };
  };

  const tryUpcDatabase = async (code: string): Promise<LookupResult | null> => {
    const res = await fetch(`https://api.upcdatabase.org/product/${code}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.title && !json.description) return null;
    return {
      name: json.title || json.description || '',
      brand: json.brand || undefined,
      description: json.description || undefined,
      category: json.category || undefined,
    };
  };

  const doLookup = useCallback(async (code: string) => {
    if (!code || code.startsWith('INT-')) return;
    setLooking(true);
    setLookupResult(null);
    try {
      const lookups = [tryInternalCatalog, tryUpcItemDb, tryBarcodeLookup, tryUpcDatabase];
      for (const lookup of lookups) {
        try {
          const result = await lookup(code.trim());
          if (result?.name) {
            setLookupResult(result);
            setLookupEditName(buildCleanName(result));
            return;
          }
        } catch {
          // Fallback al prossimo DB
        }
      }
      Alert.alert('Non trovato', 'Prodotto non presente in nessun database.\nCompila manualmente i campi.');
    } catch {
      Alert.alert('Errore rete', 'Impossibile connettersi ai database prodotti.\nVerifica la connessione internet.');
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
    if (lookupResult.brand) setBrand(lookupResult.brand);
    // Descrizione: titolo completo (se diverso dal nome pulito) + descrizione + categoria
    const parts = [
      lookupResult.description,
      lookupResult.category && `Categoria: ${lookupResult.category}`,
    ].filter(Boolean);
    if (parts.length) setDescription(parts.join('\n'));
    setLookupResult(null);
  };

  // ── Riconoscimento AI da foto ────────────────────────────────────────────────
  const identifyFromPhoto = async (source: 'camera' | 'gallery') => {
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
        });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setAiPreviewUri(asset.uri);
    setAiIdentifying(true);

    try {
      const formData = new FormData();
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      formData.append('image', {
        uri: asset.uri,
        type: asset.mimeType || `image/${ext}`,
        name: `photo.${ext}`,
      } as unknown as Blob);

      const { data } = await api.post('/vision/identify', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30_000,
      });

      // Auto-compila i campi con i dati riconosciuti
      if (data.name) setName(data.name);
      if (data.brand) {
        setBrand(data.brand);
        const desc = [data.model && `Modello: ${data.model}`, data.category].filter(Boolean).join(' · ');
        if (desc) setDescription(desc);
      }
      if (data.color) setColor(data.color);
      if (data.barcode && !barcode) setBarcode(data.barcode);

      Alert.alert('Prodotto riconosciuto', `${data.name}${data.brand ? ` (${data.brand})` : ''}`, [{ text: 'OK' }]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Impossibile riconoscere il prodotto dalla foto';
      Alert.alert('Errore', msg);
    } finally {
      setAiIdentifying(false);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('Riconoscimento AI', 'Scatta una foto o scegli dalla galleria', [
      { text: 'Fotocamera', onPress: () => identifyFromPhoto('camera') },
      { text: 'Galleria', onPress: () => identifyFromPhoto('gallery') },
      { text: 'Annulla', style: 'cancel' },
    ]);
  };

  // ── Foto prodotto (solo modifica) ─────────────────────────────────────────────
  const handleAddPhoto = async (source: 'camera' | 'gallery') => {
    if (!productId) return;
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const res = await productService.uploadPhoto(productId, result.assets[0].uri);
      setPhotos(res.photos);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare la foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const showAddPhoto = () => {
    Alert.alert('Aggiungi foto prodotto', 'Scatta una foto o scegli dalla galleria', [
      { text: 'Fotocamera', onPress: () => handleAddPhoto('camera') },
      { text: 'Galleria', onPress: () => handleAddPhoto('gallery') },
      { text: 'Annulla', style: 'cancel' },
    ]);
  };

  const handleRemovePhoto = (filename: string) => {
    if (!productId) return;
    Alert.alert('Elimina foto', 'Vuoi rimuovere questa foto?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive',
        onPress: async () => {
          try {
            const res = await productService.deletePhoto(productId, filename);
            setPhotos(res.photos);
          } catch {
            Alert.alert('Errore', 'Impossibile eliminare la foto');
          }
        },
      },
    ]);
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
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        condition,
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

        {/* ── Riconoscimento AI da foto ───────────────────────────────── */}
        <TouchableOpacity
          style={[styles.aiBtn, aiIdentifying && styles.aiBtnDisabled]}
          onPress={showPhotoOptions}
          disabled={aiIdentifying}
        >
          {aiIdentifying ? (
            <View style={styles.aiRow}>
              <ActivityIndicator size="small" color="#7C3AED" />
              <Text style={styles.aiBtnText}>Analisi in corso...</Text>
            </View>
          ) : (
            <View style={styles.aiRow}>
              <Ionicons name="sparkles" size={18} color="#7C3AED" />
              <Text style={styles.aiBtnText}>Riconosci da foto (AI)</Text>
            </View>
          )}
        </TouchableOpacity>
        {aiPreviewUri && aiIdentifying && (
          <Image source={{ uri: aiPreviewUri }} style={styles.aiPreview} />
        )}

        <Field label="Nome prodotto *" value={name} onChange={setName} placeholder="Nome del prodotto"
          voiceField="name" listeningField={listeningField} voiceState={voiceState} onVoice={startVoice} />
        <Field label="Colore / Finitura" value={color} onChange={setColor} placeholder="Es. Nero, Silver, Champagne"
          voiceField="color" listeningField={listeningField} voiceState={voiceState} onVoice={startVoice} />

        {/* ── Marca ──────────────────────────────────────────────────── */}
        <Text style={styles.label}>Marca</Text>
        <View style={styles.brandContainer}>
          <View style={styles.brandInputRow}>
            <TextInput
              style={[styles.input, styles.brandInput]}
              value={brandDropdownOpen ? brandSearch : brand}
              onChangeText={(v) => {
                setBrandSearch(v);
                if (!brandDropdownOpen) setBrandDropdownOpen(true);
              }}
              onFocus={() => { setBrandSearch(brand); setBrandDropdownOpen(true); }}
              placeholder="Seleziona o digita marca"
            />
            {brand ? (
              <TouchableOpacity style={styles.brandClearBtn} onPress={() => { setBrand(''); setBrandSearch(''); setBrandDropdownOpen(false); }}>
                <Ionicons name="close" size={16} color="#DC2626" />
              </TouchableOpacity>
            ) : null}
          </View>
          {brandDropdownOpen && (
            <View style={styles.brandDropdown}>
              {(() => {
                const q = brandSearch.toLowerCase();
                const filtered = brands.filter((b) => b.toLowerCase().includes(q));
                const exactMatch = brands.some((b) => b.toLowerCase() === q);
                return (
                  <ScrollView style={styles.brandDropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filtered.map((b) => (
                      <TouchableOpacity
                        key={b}
                        style={styles.brandOption}
                        onPress={() => { setBrand(b); setBrandDropdownOpen(false); }}
                      >
                        <Text style={[styles.brandOptionText, brand === b && styles.brandOptionTextActive]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                    {q.length > 0 && !exactMatch && (
                      <TouchableOpacity
                        style={styles.brandOptionNew}
                        onPress={() => {
                          const newBrand = brandSearch.trim();
                          if (newBrand) {
                            setBrand(newBrand);
                            setBrands((prev) => [...prev, newBrand].sort((a, b) => a.localeCompare(b)));
                          }
                          setBrandDropdownOpen(false);
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={16} color="#2563EB" />
                        <Text style={styles.brandOptionNewText}>Aggiungi "{brandSearch.trim()}"</Text>
                      </TouchableOpacity>
                    )}
                    {filtered.length === 0 && q.length === 0 && (
                      <Text style={styles.brandEmpty}>Nessuna marca registrata</Text>
                    )}
                  </ScrollView>
                );
              })()}
            </View>
          )}
        </View>

        {/* ── Categoria ──────────────────────────────────────────────── */}
        <Text style={styles.label}>Categoria</Text>
        <View style={styles.brandContainer}>
          <View style={styles.brandInputRow}>
            <TextInput
              style={[styles.input, styles.brandInput]}
              value={categoryDropdownOpen ? categorySearch : category}
              onChangeText={(v) => {
                setCategorySearch(v);
                if (!categoryDropdownOpen) setCategoryDropdownOpen(true);
              }}
              onFocus={() => { setCategorySearch(category); setCategoryDropdownOpen(true); }}
              placeholder="Seleziona o digita categoria"
            />
            {category ? (
              <TouchableOpacity style={styles.brandClearBtn} onPress={() => { setCategory(''); setCategorySearch(''); setCategoryDropdownOpen(false); }}>
                <Ionicons name="close" size={16} color="#DC2626" />
              </TouchableOpacity>
            ) : null}
          </View>
          {categoryDropdownOpen && (
            <View style={styles.brandDropdown}>
              {(() => {
                const q = categorySearch.toLowerCase();
                const filtered = categories.filter((c) => c.toLowerCase().includes(q));
                const exactMatch = categories.some((c) => c.toLowerCase() === q);
                return (
                  <ScrollView style={styles.brandDropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filtered.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={styles.brandOption}
                        onPress={() => { setCategory(c); setCategoryDropdownOpen(false); }}
                      >
                        <Text style={[styles.brandOptionText, category === c && styles.brandOptionTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                    {q.length > 0 && !exactMatch && (
                      <TouchableOpacity
                        style={styles.brandOptionNew}
                        onPress={() => {
                          const newCat = categorySearch.trim();
                          if (newCat) {
                            setCategory(newCat);
                            setCategories((prev) => [...prev, newCat].sort((a, b) => a.localeCompare(b)));
                          }
                          setCategoryDropdownOpen(false);
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={16} color="#2563EB" />
                        <Text style={styles.brandOptionNewText}>Aggiungi "{categorySearch.trim()}"</Text>
                      </TouchableOpacity>
                    )}
                    {filtered.length === 0 && q.length === 0 && (
                      <Text style={styles.brandEmpty}>Nessuna categoria registrata</Text>
                    )}
                  </ScrollView>
                );
              })()}
            </View>
          )}
        </View>

        <Field label="Descrizione" value={description} onChange={setDescription} placeholder="Opzionale" multiline
          voiceField="description" listeningField={listeningField} voiceState={voiceState} onVoice={startVoice} />
        <Field label="Quantità" value={quantity} onChange={setQuantity} placeholder="1" keyboardType="numeric" />

        {/* ── Stato prodotto ──────────────────────────────────────────── */}
        <Text style={styles.label}>Stato</Text>
        <View style={styles.conditionRow}>
          {(['nuovo', 'usato', 'vuoto'] as const).map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.conditionBtn, condition === c && styles.conditionBtnActive]}
              onPress={() => setCondition(c)}
            >
              <Text style={[styles.conditionBtnText, condition === c && styles.conditionBtnTextActive]}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
          voiceField="slot" listeningField={listeningField} voiceState={voiceState} onVoice={startVoice} />

        {/* ── Foto prodotto (solo in modifica) ───────────────────────── */}
        {isEdit && (
          <>
            <Text style={styles.label}>Foto prodotto</Text>
            <View style={styles.photoGrid}>
              {photos.map((filename) => (
                <TouchableOpacity key={filename} onLongPress={() => handleRemovePhoto(filename)} style={styles.photoWrap}>
                  <Image
                    source={{ uri: `${getServerUrl()}/uploads/products/${filename}` }}
                    style={styles.photoThumb}
                  />
                </TouchableOpacity>
              ))}
              {photos.length < 5 && (
                <TouchableOpacity style={styles.addPhotoBox} onPress={showAddPhoto} disabled={uploadingPhoto}>
                  {uploadingPhoto
                    ? <ActivityIndicator size="small" color="#2563EB" />
                    : <Ionicons name="add-circle-outline" size={28} color="#9CA3AF" />
                  }
                  <Text style={styles.addPhotoBoxText}>{uploadingPhoto ? 'Caricamento...' : 'Aggiungi'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {photos.length > 0 && (
              <Text style={styles.hint}>Tieni premuto su una foto per eliminarla</Text>
            )}
            {!isEdit && (
              <Text style={styles.hint}>Potrai aggiungere foto dopo il salvataggio.</Text>
            )}
          </>
        )}

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
  voiceField, listeningField, voiceState, onVoice,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  voiceField?: string;
  listeningField?: string | null;
  voiceState?: 'idle' | 'recording' | 'transcribing';
  onVoice?: (field: string) => void;
}) {
  const isThisField = !!voiceField && listeningField === voiceField;
  const isRecording = isThisField && voiceState === 'recording';
  const isTranscribing = isThisField && voiceState === 'transcribing';
  const isActive = isRecording || isTranscribing;
  const isDisabled = !isThisField && voiceState !== 'idle';

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
            style={[styles.micBtn, isActive && styles.micBtnActive]}
            onPress={() => onVoice(voiceField)}
            disabled={isDisabled || isTranscribing}
          >
            {isTranscribing
              ? <ActivityIndicator size="small" color="#DC2626" />
              : <Ionicons
                  name={isRecording ? 'stop-circle-outline' : 'mic-outline'}
                  size={20}
                  color={isActive ? '#DC2626' : isDisabled ? '#D1D5DB' : '#374151'}
                />
            }
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

  // Brand select
  brandContainer: { zIndex: 10 },
  brandInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandInput: { flex: 1 },
  brandClearBtn: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 10 },
  brandDropdown: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, marginTop: 4, maxHeight: 180,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },
  brandDropdownScroll: { padding: 4 },
  brandOption: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  brandOptionText: { fontSize: 14, color: '#374151' },
  brandOptionTextActive: { color: '#2563EB', fontWeight: '700' },
  brandOptionNew: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#EFF6FF',
    borderRadius: 6, margin: 4,
  },
  brandOptionNewText: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  brandEmpty: { fontSize: 13, color: '#9CA3AF', padding: 12, textAlign: 'center' },

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

  // Condition picker
  conditionRow: { flexDirection: 'row', gap: 10 },
  conditionBtn: {
    flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff',
  },
  conditionBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  conditionBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  conditionBtnTextActive: { color: '#fff' },

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

  // AI riconoscimento foto
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE',
    borderRadius: 10, padding: 14, marginTop: 16,
  },
  aiBtnDisabled: { opacity: 0.6 },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiBtnText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  aiPreview: {
    width: '100%', height: 160, borderRadius: 10, marginTop: 10,
    backgroundColor: '#F3F4F6',
  },

  // Photo grid
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { borderRadius: 8, overflow: 'hidden' },
  photoThumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#E5E7EB' },
  addPhotoBox: {
    width: 80, height: 80, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#D1D5DB', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB',
  },
  addPhotoBoxText: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

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
