import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Warehouse, RootStackParamList } from '../../types';
import { warehouseService } from '../../services/warehouseService';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;

export default function WarehouseListScreen({ navigation }: Props) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Campi form creazione
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newWidth, setNewWidth] = useState('10');
  const [newHeight, setNewHeight] = useState('10');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await warehouseService.getAll();
      setWarehouses(data);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare i magazzini');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openModal = () => {
    setNewName('');
    setNewDesc('');
    setNewWidth('10');
    setNewHeight('10');
    setModalVisible(true);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      Alert.alert('Errore', 'Il nome del magazzino è obbligatorio');
      return;
    }
    const w = parseInt(newWidth, 10);
    const h = parseInt(newHeight, 10);
    if (!w || !h || w < 1 || h < 1) {
      Alert.alert('Errore', 'Larghezza e altezza devono essere almeno 1');
      return;
    }
    setSaving(true);
    try {
      await warehouseService.create({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        gridWidth: w,
        gridHeight: h,
      });
      setModalVisible(false);
      await load();
    } catch {
      Alert.alert('Errore', 'Impossibile creare il magazzino');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Warehouse }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        (navigation as unknown as { navigate: (s: string, p: object) => void }).navigate(
          'WarehouseMap',
          { warehouseId: item._id, warehouseName: item.name }
        )
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardMeta}>
          {item.gridWidth} × {item.gridHeight}
        </Text>
      </View>
      {item.description ? (
        <Text style={styles.cardDescription}>{item.description}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={warehouses}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nessun magazzino.{'\n'}Creane uno con il pulsante +
          </Text>
        }
      />

      {/* FAB crea magazzino */}
      <TouchableOpacity style={styles.fab} onPress={openModal}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Modal creazione magazzino */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuovo Magazzino</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="Es. Magazzino Nord"
                autoFocus
              />

              <Text style={styles.fieldLabel}>Descrizione</Text>
              <TextInput
                style={styles.input}
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="Opzionale"
              />

              <View style={styles.gridRow}>
                <View style={styles.gridField}>
                  <Text style={styles.fieldLabel}>Colonne griglia</Text>
                  <TextInput
                    style={styles.input}
                    value={newWidth}
                    onChangeText={setNewWidth}
                    keyboardType="numeric"
                    placeholder="10"
                  />
                </View>
                <View style={styles.gridField}>
                  <Text style={styles.fieldLabel}>Righe griglia</Text>
                  <TextInput
                    style={styles.input}
                    value={newHeight}
                    onChangeText={setNewHeight}
                    keyboardType="numeric"
                    placeholder="10"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.createBtn, saving && styles.createBtnDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                <Text style={styles.createBtnText}>
                  {saving ? 'Creazione...' : 'Crea magazzino'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  list: { padding: 16, paddingBottom: 88 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  cardMeta: {
    fontSize: 12, color: '#6B7280', backgroundColor: '#F3F4F6',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  cardDescription: { marginTop: 8, fontSize: 14, color: '#6B7280' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 60, fontSize: 16, lineHeight: 26 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    backgroundColor: '#2563EB', width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 22, color: '#6B7280', paddingHorizontal: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: '#F9FAFB',
  },
  gridRow: { flexDirection: 'row', gap: 12 },
  gridField: { flex: 1 },
  createBtn: {
    backgroundColor: '#2563EB', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  createBtnDisabled: { backgroundColor: '#93C5FD' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
