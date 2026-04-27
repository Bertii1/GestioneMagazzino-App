import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, Alert, Image, Modal,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Product, RootStackParamList } from '../../types';
import { productService } from '../../services/productService';
import { getServerUrl } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;
type Nav = { navigate: (s: string, p?: object) => void };

export default function ProductListScreen({ navigation }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterBrand, setFilterBrand] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef(search);
  const filterBrandRef = useRef(filterBrand);
  const filterCategoryRef = useRef(filterCategory);

  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { filterBrandRef.current = filterBrand; }, [filterBrand]);
  useEffect(() => { filterCategoryRef.current = filterCategory; }, [filterCategory]);

  const activeFiltersCount = (filterBrand ? 1 : 0) + (filterCategory ? 1 : 0);

  const load = useCallback(async (q?: string, brand?: string, category?: string) => {
    try {
      const params: Parameters<typeof productService.getAll>[0] = {};
      if (q) params.q = q;
      if (brand) params.brand = brand;
      if (category) params.category = category;
      const data = await productService.getAll(Object.keys(params).length ? params : undefined);
      setProducts(data);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare i prodotti');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(
        searchRef.current.trim() || undefined,
        filterBrandRef.current ?? undefined,
        filterCategoryRef.current ?? undefined,
      );
    }, [load])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load(search.trim() || undefined, filterBrand ?? undefined, filterCategory ?? undefined);
    }, 700);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, filterBrand, filterCategory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(search.trim() || undefined, filterBrand ?? undefined, filterCategory ?? undefined);
    setRefreshing(false);
  };

  const openFilterModal = async () => {
    setShowFilterModal(true);
    if (brands.length === 0 && categories.length === 0) {
      setLoadingFilters(true);
      try {
        const [b, c] = await Promise.all([productService.getBrands(), productService.getCategories()]);
        setBrands(b);
        setCategories(c);
      } catch {
        // silenzioso
      } finally {
        setLoadingFilters(false);
      }
    }
  };

  const nav = navigation as unknown as Nav;
  const getShelfCode = (product: Product): string =>
    typeof product.shelfId === 'object' ? product.shelfId.code : '—';

  const renderItem = ({ item }: { item: Product }) => {
    const thumb = item.photos?.[0];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => nav.navigate('ProductDetail', { productId: item._id })}
      >
        <View style={styles.cardRow}>
          {thumb ? (
            <Image
              source={{ uri: `${getServerUrl()}/uploads/products/${thumb}` }}
              style={styles.cardThumb}
            />
          ) : null}
          <View style={thumb ? styles.cardContent : styles.cardContentFull}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.cardQty}>x {item.quantity}</Text>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.cardBarcode}>{item.barcode}</Text>
              <View style={styles.cardMeta}>
                {item.condition && (
                  <View style={[
                    styles.conditionTag,
                    item.condition === 'nuovo' && styles.conditionTagNuovo,
                    item.condition === 'usato' && styles.conditionTagUsato,
                    item.condition === 'vuoto' && styles.conditionTagVuoto,
                  ]}>
                    <Text style={[
                      styles.conditionTagText,
                      item.condition === 'nuovo' && styles.conditionTagTextNuovo,
                      item.condition === 'usato' && styles.conditionTagTextUsato,
                      item.condition === 'vuoto' && styles.conditionTagTextVuoto,
                    ]}>
                      {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                    </Text>
                  </View>
                )}
                {item.color ? (
                  <View style={styles.colorTag}>
                    <Text style={styles.colorTagText}>{item.color}</Text>
                  </View>
                ) : null}
                {item.brand ? (
                  <View style={styles.brandTag}>
                    <Text style={styles.brandTagText}>{item.brand}</Text>
                  </View>
                ) : null}
                <Text style={styles.cardPosition}>
                  {getShelfCode(item)} · R{item.level}
                  {item.slot ? ` · ${item.slot}` : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Barra ricerca + filtro */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca nome, marca o barcode..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            load(search.trim() || undefined, filterBrand ?? undefined, filterCategory ?? undefined);
          }}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={[styles.filterBtn, activeFiltersCount > 0 && styles.filterBtnActive]}
          onPress={openFilterModal}
        >
          <Ionicons name="options-outline" size={20} color={activeFiltersCount > 0 ? '#fff' : '#374151'} />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Chip filtri attivi */}
      {(filterBrand || filterCategory) ? (
        <View style={styles.activeFiltersRow}>
          {filterBrand ? (
            <TouchableOpacity style={styles.activeChip} onPress={() => setFilterBrand(null)}>
              <Text style={styles.activeChipText}>{filterBrand}</Text>
              <Ionicons name="close" size={13} color="#1D4ED8" />
            </TouchableOpacity>
          ) : null}
          {filterCategory ? (
            <TouchableOpacity style={styles.activeChip} onPress={() => setFilterCategory(null)}>
              <Text style={styles.activeChipText}>{filterCategory}</Text>
              <Ionicons name="close" size={13} color="#1D4ED8" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => { setFilterBrand(null); setFilterCategory(null); }}>
            <Text style={styles.clearAll}>Cancella tutti</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Nessun prodotto trovato</Text>}
      />

      <TouchableOpacity style={[styles.fab, styles.fabScan]} onPress={() => nav.navigate('ScanBarcode')}>
        <Ionicons name="barcode-outline" size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.fab, styles.fabNew]} onPress={() => nav.navigate('ProductForm', {})}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal filtri */}
      <Modal visible={showFilterModal} animationType="slide" transparent onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtri</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {loadingFilters ? (
              <ActivityIndicator color="#2563EB" style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Marca */}
                <Text style={styles.sectionLabel}>Marca</Text>
                {brands.length === 0 ? (
                  <Text style={styles.noOptions}>Nessuna marca disponibile</Text>
                ) : (
                  <View style={styles.chipGrid}>
                    {brands.map((b) => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.chip, filterBrand === b && styles.chipActive]}
                        onPress={() => setFilterBrand(filterBrand === b ? null : b)}
                      >
                        <Text style={[styles.chipText, filterBrand === b && styles.chipTextActive]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Categoria */}
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Categoria</Text>
                {categories.length === 0 ? (
                  <Text style={styles.noOptions}>Nessuna categoria disponibile</Text>
                ) : (
                  <View style={styles.chipGrid}>
                    {categories.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.chip, filterCategory === c && styles.chipActive]}
                        onPress={() => setFilterCategory(filterCategory === c ? null : c)}
                      >
                        <Text style={[styles.chipText, filterCategory === c && styles.chipTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => { setFilterBrand(null); setFilterCategory(null); setShowFilterModal(false); }}
              >
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilterModal(false)}>
                <Text style={styles.applyBtnText}>Applica</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  filterBtn: {
    width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#DC2626',
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  activeFiltersRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    gap: 6, paddingHorizontal: 12, paddingBottom: 8,
  },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5,
  },
  activeChipText: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' },
  clearAll: { fontSize: 12, color: '#6B7280', textDecorationLine: 'underline', paddingVertical: 5 },

  list: { padding: 12, paddingBottom: 100 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 60, fontSize: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#E5E7EB' },
  cardContent: { flex: 1 },
  cardContentFull: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  cardQty: { fontSize: 15, fontWeight: '700', color: '#059669', marginLeft: 8 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  cardBarcode: { fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  conditionTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  conditionTagNuovo: { backgroundColor: '#DCFCE7' },
  conditionTagUsato: { backgroundColor: '#FEF3C7' },
  conditionTagVuoto: { backgroundColor: '#FEE2E2' },
  conditionTagText: { fontSize: 10, fontWeight: '700' },
  conditionTagTextNuovo: { color: '#16A34A' },
  conditionTagTextUsato: { color: '#D97706' },
  conditionTagTextVuoto: { color: '#DC2626' },
  colorTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#EDE9FE' },
  colorTagText: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },
  brandTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#DBEAFE' },
  brandTagText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  cardPosition: { fontSize: 12, color: '#6B7280' },

  fab: {
    position: 'absolute', bottom: 24,
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center', elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 5,
  },
  fabScan: { right: 86, backgroundColor: '#059669' },
  fabNew: { right: 20, backgroundColor: '#2563EB' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '75%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  noOptions: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 8 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#fff',
  },
  chipActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  chipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#2563EB', fontWeight: '700' },
  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 20 },
  resetBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  resetBtnText: { color: '#374151', fontWeight: '600', fontSize: 15 },
  applyBtn: { flex: 2, backgroundColor: '#2563EB', borderRadius: 10, padding: 14, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
