import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Alert, ScrollView, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Product, Shelf, Warehouse } from '../../types';
import { productService } from '../../services/productService';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export default function ProductDetailScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      productService
        .getById(productId)
        .then(setProduct)
        .catch(() => Alert.alert('Errore', 'Prodotto non trovato'))
        .finally(() => setLoading(false));
    }, [productId])
  );

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
        {product.color ? (
          <View style={styles.colorBadge}>
            <Text style={styles.colorBadgeText}>{product.color}</Text>
          </View>
        ) : null}
        <Text style={styles.barcode}>{product.barcode}</Text>
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
      </View>

      {/* Dettagli */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dettagli</Text>
        <Row label="Quantità" value={String(product.quantity)} />
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
  colorBadge: {
    alignSelf: 'flex-start', backgroundColor: '#1D4ED8',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6,
  },
  colorBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  barcode: { fontSize: 14, color: '#6B7280', fontFamily: 'monospace', marginTop: 6 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  positionCard: { backgroundColor: '#fff', borderRadius: 10, padding: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  editBtn: { flex: 1, backgroundColor: '#2563EB', borderRadius: 8, padding: 14, alignItems: 'center' },
  editBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 15 },
});
