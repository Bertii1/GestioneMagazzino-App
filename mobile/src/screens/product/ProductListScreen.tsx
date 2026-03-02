import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Product, RootStackParamList } from '../../types';
import { productService } from '../../services/productService';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;
type Nav = { navigate: (s: string, p?: object) => void };

export default function ProductListScreen({ navigation }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q?: string) => {
    try {
      const data = await productService.getAll(q ? { q } : undefined);
      setProducts(data);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare i prodotti');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(search.trim() || undefined);
    }, [load])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load(search.trim() || undefined);
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(search.trim() || undefined);
    setRefreshing(false);
  };

  const handleSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    load(search.trim() || undefined);
  };
  const nav = navigation as unknown as Nav;

  const getShelfCode = (product: Product): string => {
    if (typeof product.shelfId === 'object') return product.shelfId.code;
    return '—';
  };

  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => nav.navigate('ProductDetail', { productId: item._id })}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardQty}>× {item.quantity}</Text>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardBarcode}>{item.barcode}</Text>
        <Text style={styles.cardPosition}>
          {getShelfCode(item)} · R{item.level}
          {item.slot ? ` · ${item.slot}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Barra di ricerca */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca nome o barcode..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Ionicons name="search-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Nessun prodotto trovato</Text>}
      />

      {/* FAB scansiona barcode */}
      <TouchableOpacity
        style={[styles.fab, styles.fabScan]}
        onPress={() => nav.navigate('ScanBarcode')}
      >
        <Ionicons name="barcode-outline" size={24} color="#fff" />
      </TouchableOpacity>

      {/* FAB nuovo prodotto manuale (senza barcode) */}
      <TouchableOpacity
        style={[styles.fab, styles.fabNew]}
        onPress={() => nav.navigate('ProductForm', {})}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  searchRow: { flexDirection: 'row', padding: 12, gap: 8 },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff',
  },
  searchBtn: {
    backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600' },
  list: { padding: 12, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  cardQty: { fontSize: 15, fontWeight: '700', color: '#059669', marginLeft: 8 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cardBarcode: { fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' },
  cardPosition: { fontSize: 12, color: '#6B7280' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 60, fontSize: 16 },
  fab: {
    position: 'absolute', bottom: 24,
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center', elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 5,
  },
  fabScan: { right: 86, backgroundColor: '#059669' },
  fabNew:  { right: 20, backgroundColor: '#2563EB' },
  fabText: { color: '#fff', fontSize: 24, lineHeight: 28 },
});
