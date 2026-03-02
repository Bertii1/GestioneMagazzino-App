import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Product, Shelf } from '../../types';
import { shelfService } from '../../services/shelfService';
import { productService } from '../../services/productService';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'ShelfDetail'>;

export default function ShelfDetailScreen({ route, navigation }: Props) {
  const { shelfId, warehouseId, levelFocus } = route.params;
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const flatListRef = useRef<FlatList<number>>(null);
  const didScrollRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [sh, prods] = await Promise.all([
        shelfService.getById(shelfId),
        productService.getAll({ shelfId }),
      ]);
      setShelf(sh);
      setProducts(prods);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare i dati dello scaffale');
    } finally {
      setLoading(false);
    }
  }, [shelfId]);

  useFocusEffect(useCallback(() => {
    didScrollRef.current = false;
    loadData();
  }, [loadData]));

  // Scroll al ripiano focalizzato dopo il caricamento dati
  useEffect(() => {
    if (!levelFocus || !shelf || didScrollRef.current) return;
    didScrollRef.current = true;
    const idx = levelFocus - 1;
    if (idx >= 0 && idx < shelf.levels) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true });
      }, 300);
    }
  }, [shelf, levelFocus]);

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      'Elimina prodotto',
      `Eliminare "${product.name}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await productService.delete(product._id);
              setProducts(prev => prev.filter(p => p._id !== product._id));
            } catch {
              Alert.alert('Errore', 'Impossibile eliminare il prodotto');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }
  if (!shelf) return null;

  const productsByLevel: Record<number, Product[]> = {};
  for (const p of products) {
    if (!productsByLevel[p.level]) productsByLevel[p.level] = [];
    productsByLevel[p.level].push(p);
  }

  return (
    <View style={styles.container}>
      {/* Intestazione scaffale */}
      <View style={styles.header}>
        <Text style={styles.headerCode}>Scaffale {shelf.code}</Text>
        {shelf.name && <Text style={styles.headerName}>{shelf.name}</Text>}
        <Text style={styles.headerMeta}>
          {shelf.levels} ripiani · ({shelf.x}, {shelf.y})
        </Text>
      </View>

      {/* Visualizzazione ripiani */}
      <FlatList
        ref={flatListRef}
        data={Array.from({ length: shelf.levels }, (_, i) => i + 1)}
        keyExtractor={(item) => String(item)}
        contentContainerStyle={styles.list}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item: level }) => {
          const levelProducts = productsByLevel[level] || [];
          const isFocused = level === levelFocus;
          return (
            <View style={[styles.levelCard, isFocused && styles.levelCardFocused]}>
              <View style={[styles.levelHeader, isFocused && styles.levelHeaderFocused]}>
                <Text style={[styles.levelTitle, isFocused && styles.levelTitleFocused]}>
                  Ripiano {level}
                </Text>
                <View style={styles.levelActions}>
                  <TouchableOpacity
                    style={rowStyles.qrBtn}
                    onPress={() =>
                      navigation.navigate('ShelfQR', {
                        shelfId,
                        shelfCode: shelf.code,
                        shelfName: shelf.name,
                        warehouseId,
                        level,
                      })
                    }
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="qr-code-outline" size={11} color="#fff" />
                      <Text style={rowStyles.qrBtnText}>QR</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={rowStyles.addBtn}
                    onPress={() =>
                      navigation.navigate('ProductForm', { shelfId, warehouseId, level })
                    }
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="add" size={13} color="#fff" />
                      <Text style={rowStyles.addBtnText}>Prodotto</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {levelProducts.length === 0 ? (
                <Text style={styles.empty}>Nessun prodotto</Text>
              ) : (
                levelProducts.map((product) => (
                  <View key={product._id} style={styles.productRow}>
                    <TouchableOpacity
                      style={styles.productInfo}
                      onPress={() => navigation.navigate('ProductDetail', { productId: product._id })}
                    >
                      <View style={styles.productNameRow}>
                        <Text style={styles.productName}>{product.name}</Text>
                        {product.color ? (
                          <Text style={styles.productColor}>{product.color}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.productBarcode}>{product.barcode}</Text>
                    </TouchableOpacity>
                    <View style={styles.productRight}>
                      {product.slot && <Text style={styles.productSlot}>{product.slot}</Text>}
                      <Text style={styles.productQty}>× {product.quantity}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteProduct(product)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  qrBtn: {
    backgroundColor: '#1D4ED8', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  qrBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  addBtn: {
    backgroundColor: '#059669', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#EFF6FF', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#DBEAFE',
  },
  headerCode: { fontSize: 22, fontWeight: '700', color: '#1D4ED8' },
  headerName: { fontSize: 15, color: '#374151', marginTop: 2 },
  headerMeta: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  list: { padding: 16, paddingBottom: 32 },
  levelCard: {
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 16,
    overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  levelCardFocused: {
    borderWidth: 2, borderColor: '#2563EB',
  },
  levelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, backgroundColor: '#F3F4F6',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  levelHeaderFocused: {
    backgroundColor: '#EFF6FF',
  },
  levelTitle: { fontWeight: '700', fontSize: 14, color: '#374151' },
  levelTitleFocused: { color: '#1D4ED8' },
  levelActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { padding: 16, color: '#9CA3AF', fontSize: 14, textAlign: 'center' },
  productRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  productInfo: { flex: 1 },
  productNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  productName: { fontSize: 15, fontWeight: '500', color: '#111827' },
  productColor: {
    fontSize: 11, fontWeight: '700', color: '#1D4ED8',
    backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
  },
  productBarcode: { fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 },
  productRight: { alignItems: 'flex-end', marginRight: 8 },
  productSlot: {
    fontSize: 12, color: '#6B7280', backgroundColor: '#F3F4F6',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4,
  },
  productQty: { fontSize: 13, fontWeight: '600', color: '#059669' },
  deleteBtn: {
    padding: 8, borderRadius: 6, backgroundColor: '#FEF2F2',
  },
  deleteBtnText: { fontSize: 13, color: '#EF4444', fontWeight: '700' },
});
