import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Alert, ScrollView, TouchableOpacity, Image, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList, Product, Shelf, Warehouse } from '../../types';
import { productService } from '../../services/productService';
import { getServerUrl } from '../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

const PHOTO_SIZE = (Dimensions.get('window').width - 48) / 3;

export default function ProductDetailScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      productService
        .getById(productId)
        .then(setProduct)
        .catch(() => Alert.alert('Errore', 'Prodotto non trovato'))
        .finally(() => setLoading(false));
    }, [productId])
  );

  const addPhoto = async (source: 'camera' | 'gallery') => {
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const { photos } = await productService.uploadPhoto(productId, result.assets[0].uri);
      setProduct((prev) => prev ? { ...prev, photos } : prev);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare la foto');
    } finally {
      setUploading(false);
    }
  };

  const showAddPhotoOptions = () => {
    Alert.alert('Aggiungi foto', 'Scatta una foto o scegli dalla galleria', [
      { text: 'Fotocamera', onPress: () => addPhoto('camera') },
      { text: 'Galleria', onPress: () => addPhoto('gallery') },
      { text: 'Annulla', style: 'cancel' },
    ]);
  };

  const handleDeletePhoto = (filename: string) => {
    Alert.alert('Elimina foto', 'Vuoi rimuovere questa foto?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive',
        onPress: async () => {
          try {
            const { photos } = await productService.deletePhoto(productId, filename);
            setProduct((prev) => prev ? { ...prev, photos } : prev);
          } catch {
            Alert.alert('Errore', 'Impossibile eliminare la foto');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Elimina prodotto', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive',
        onPress: async () => {
          try {
            await productService.delete(productId);
            navigation.goBack();
          } catch {
            Alert.alert('Errore', 'Impossibile eliminare il prodotto');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }
  if (!product) return null;

  const shelf = product.shelfId as Shelf;
  const warehouse = product.warehouseId as Warehouse;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name}>{product.name}</Text>
        {product.brand ? (
          <Text style={styles.brandText}>{product.brand}</Text>
        ) : null}
        {product.color ? (
          <View style={styles.colorBadge}>
            <Text style={styles.colorBadgeText}>{product.color}</Text>
          </View>
        ) : null}
        <Text style={styles.barcode}>{product.barcode}</Text>
      </View>

      {/* Foto */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Foto</Text>
        <View style={styles.photoGrid}>
          {(product.photos ?? []).map((filename) => (
            <TouchableOpacity key={filename} onLongPress={() => handleDeletePhoto(filename)} style={styles.photoWrap}>
              <Image
                source={{ uri: `${getServerUrl()}/uploads/products/${filename}` }}
                style={styles.photoThumb}
              />
            </TouchableOpacity>
          ))}
          {(product.photos ?? []).length < 5 && (
            <TouchableOpacity style={styles.addPhotoBtn} onPress={showAddPhotoOptions} disabled={uploading}>
              {uploading
                ? <ActivityIndicator size="small" color="#2563EB" />
                : <Ionicons name="add-circle-outline" size={32} color="#9CA3AF" />
              }
              <Text style={styles.addPhotoText}>{uploading ? 'Caricamento...' : 'Aggiungi'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {(product.photos ?? []).length > 0 && (
          <Text style={styles.photoHint}>Tieni premuto su una foto per eliminarla</Text>
        )}
      </View>

      {/* Posizione */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Posizione</Text>
        <View style={styles.positionCard}>
          <Row label="Magazzino" value={warehouse?.name ?? '—'} />
          <Row label="Scaffale" value={typeof shelf === 'object' ? `${shelf.code}${shelf.name ? ` · ${shelf.name}` : ''}` : '—'} />
          <Row label="Ripiano" value={String(product.level)} />
          {product.slot && <Row label="Slot" value={product.slot} />}
        </View>
        {warehouse && typeof shelf === 'object' && (
          <TouchableOpacity
            style={styles.findBtn}
            onPress={() =>
              navigation.navigate('WarehouseMap', {
                warehouseId: warehouse._id,
                warehouseName: warehouse.name,
                highlightShelfId: shelf._id,
              })
            }
          >
            <Ionicons name="map-outline" size={16} color="#2563EB" />
            <Text style={styles.findBtnText}>Trova sulla mappa</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dettagli */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dettagli</Text>
        <Row label="Quantità" value={String(product.quantity)} />
        <Row label="Stato" value={product.condition ? product.condition.charAt(0).toUpperCase() + product.condition.slice(1) : 'Nuovo'} />
        {product.color && <Row label="Colore / Finitura" value={product.color} />}
        {product.description && <Row label="Descrizione" value={product.description} />}
        {product.details &&
          Object.entries(product.details).map(([key, val]) => (
            <Row key={key} label={key} value={String(val)} />
          ))}
      </View>

      {/* Azioni */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('ProductForm', { productId })}
        >
          <Text style={styles.editBtnText}>Modifica</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Elimina</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  label: { fontSize: 14, color: '#6B7280' },
  value: { fontSize: 14, fontWeight: '500', color: '#111827', flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16, marginBottom: 16 },
  name: { fontSize: 22, fontWeight: '700', color: '#111827' },
  brandText: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginTop: 2 },
  colorBadge: {
    alignSelf: 'flex-start', backgroundColor: '#1D4ED8',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6,
  },
  colorBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  barcode: { fontSize: 14, color: '#6B7280', fontFamily: 'monospace', marginTop: 6 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  positionCard: { backgroundColor: '#fff', borderRadius: 10, padding: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { borderRadius: 8, overflow: 'hidden' },
  photoThumb: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 8, backgroundColor: '#E5E7EB' },
  addPhotoBtn: {
    width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#D1D5DB', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB',
  },
  addPhotoText: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  photoHint: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  findBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  findBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  editBtn: { flex: 1, backgroundColor: '#2563EB', borderRadius: 8, padding: 14, alignItems: 'center' },
  editBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 15 },
});
