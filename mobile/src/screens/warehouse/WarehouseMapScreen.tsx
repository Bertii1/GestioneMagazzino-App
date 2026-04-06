import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert,
  Modal, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Shelf, Warehouse } from '../../types';
import { warehouseService } from '../../services/warehouseService';
import { shelfService } from '../../services/shelfService';
import WarehouseMap from '../../components/WarehouseMap';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'WarehouseMap'>;

/** col=0,row=0 → "A1" */
const cellCode = (x: number, y: number): string =>
  `${String.fromCharCode(65 + x)}${y + 1}`;

export default function WarehouseMapScreen({ route, navigation }: Props) {
  const { warehouseId } = route.params;

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);

  // Selezione: scaffale esistente OPPURE cella vuota
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);

  // Modal creazione scaffale
  const [modalVisible, setModalVisible] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newLevels, setNewLevels] = useState('3');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [wh, sh] = await Promise.all([
        warehouseService.getById(warehouseId),
        shelfService.getByWarehouse(warehouseId),
      ]);
      setWarehouse(wh);
      setShelves(sh);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare la mappa');
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleShelfPress = (shelf: Shelf) => {
    setSelectedCell(null);
    setSelectedShelf((prev) => prev?._id === shelf._id ? null : shelf);
  };

  const handleCellPress = (x: number, y: number) => {
    setSelectedShelf(null);
    setSelectedCell((prev) =>
      prev?.x === x && prev?.y === y ? null : { x, y }
    );
  };

  const openCreateModal = () => {
    if (!selectedCell) return;
    setNewCode(cellCode(selectedCell.x, selectedCell.y));
    setNewName('');
    setNewLevels('3');
    setModalVisible(true);
  };

  const handleCreateShelf = async () => {
    if (!selectedCell || !newCode.trim()) {
      Alert.alert('Errore', 'Il codice scaffale è obbligatorio');
      return;
    }
    const levels = parseInt(newLevels, 10);
    if (!levels || levels < 1) {
      Alert.alert('Errore', 'I ripiani devono essere almeno 1');
      return;
    }
    setSaving(true);
    try {
      await shelfService.create(warehouseId, {
        code: newCode.trim().toUpperCase(),
        name: newName.trim() || undefined,
        x: selectedCell.x,
        y: selectedCell.y,
        levels,
      });
      setModalVisible(false);
      setSelectedCell(null);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Impossibile creare lo scaffale';
      Alert.alert('Errore', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }
  if (!warehouse) return null;

  return (
    <View style={styles.container}>

      {/* Legenda */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>
          {warehouse.gridWidth} × {warehouse.gridHeight} · {shelves.length} scaffali
        </Text>
        <Text style={styles.legendHint}>
          Tocca una cella vuota per aggiungere uno scaffale
        </Text>
      </View>

      {/* Mappa SVG */}
      <WarehouseMap
        gridWidth={warehouse.gridWidth}
        gridHeight={warehouse.gridHeight}
        shelves={shelves}
        selectedShelfId={selectedShelf?._id}
        selectedCell={selectedCell ?? undefined}
        onShelfPress={handleShelfPress}
        onCellPress={handleCellPress}
      />

      {/* Pannello: scaffale selezionato */}
      {selectedShelf && (
        <View style={styles.panel}>
          <View style={styles.panelInfo}>
            <Text style={styles.panelTitle}>Scaffale {selectedShelf.code}</Text>
            {selectedShelf.name ? (
              <Text style={styles.panelSubtitle}>{selectedShelf.name}</Text>
            ) : null}
            <Text style={styles.panelMeta}>
              {selectedShelf.levels} ripiani · ({selectedShelf.x}, {selectedShelf.y})
            </Text>
          </View>
          <TouchableOpacity
            style={styles.panelBtnDelete}
            onPress={() => {
              Alert.alert(
                'Elimina scaffale',
                `Eliminare lo scaffale "${selectedShelf.code}" e tutti i suoi prodotti?`,
                [
                  { text: 'Annulla', style: 'cancel' },
                  {
                    text: 'Elimina',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await shelfService.delete(selectedShelf._id);
                        setSelectedShelf(null);
                        await load();
                      } catch {
                        Alert.alert('Errore', 'Impossibile eliminare lo scaffale');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.panelBtn}
            onPress={() =>
              navigation.navigate('ShelfDetail', {
                shelfId: selectedShelf._id,
                warehouseId,
              })
            }
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.panelBtnText}>Apri</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Pannello: cella vuota selezionata */}
      {selectedCell && !selectedShelf && (
        <View style={[styles.panel, styles.panelEmpty]}>
          <View style={styles.panelInfo}>
            <Text style={styles.panelTitleEmpty}>
              Cella {cellCode(selectedCell.x, selectedCell.y)} — libera
            </Text>
            <Text style={styles.panelMeta}>
              Posizione ({selectedCell.x}, {selectedCell.y})
            </Text>
          </View>
          <TouchableOpacity style={styles.panelBtnCreate} onPress={openCreateModal}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.panelBtnCreateText}>Scaffale</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal creazione scaffale */}
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
              <Text style={styles.modalTitle}>
                Nuovo scaffale
                {selectedCell ? ` in ${cellCode(selectedCell.x, selectedCell.y)}` : ''}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Codice *</Text>
              <TextInput
                style={styles.input}
                value={newCode}
                onChangeText={(t) => setNewCode(t.toUpperCase())}
                placeholder="Es. A1, B3"
                autoCapitalize="characters"
                autoFocus
              />

              <Text style={styles.fieldLabel}>Nome (opzionale)</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="Es. Scaffale materiali elettrici"
              />

              <Text style={styles.fieldLabel}>Numero di ripiani</Text>
              <TextInput
                style={styles.input}
                value={newLevels}
                onChangeText={setNewLevels}
                keyboardType="numeric"
                placeholder="3"
              />

              <TouchableOpacity
                style={[styles.createBtn, saving && styles.createBtnDisabled]}
                onPress={handleCreateShelf}
                disabled={saving}
              >
                <Text style={styles.createBtnText}>
                  {saving ? 'Creazione...' : 'Crea scaffale'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  legend: {
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: '#F3F4F6', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  legendText: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  legendHint: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 2 },
  panel: {
    padding: 16, backgroundColor: '#EFF6FF',
    borderTopWidth: 2, borderTopColor: '#2563EB',
    flexDirection: 'row', alignItems: 'center',
  },
  panelEmpty: { backgroundColor: '#FFFBEB', borderTopColor: '#F59E0B' },
  panelInfo: { flex: 1, marginRight: 12 },
  panelTitle: { fontSize: 17, fontWeight: '700', color: '#1D4ED8' },
  panelTitleEmpty: { fontSize: 17, fontWeight: '700', color: '#92400E' },
  panelSubtitle: { fontSize: 13, color: '#374151', marginTop: 2 },
  panelMeta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  panelBtnDelete: {
    padding: 10, borderRadius: 8, backgroundColor: '#FEF2F2', marginRight: 8,
  },
  panelBtn: {
    backgroundColor: '#2563EB', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  panelBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  panelBtnCreate: {
    backgroundColor: '#F59E0B', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  panelBtnCreateText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  modalClose: { fontSize: 22, color: '#6B7280', paddingHorizontal: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: '#F9FAFB',
  },
  createBtn: {
    backgroundColor: '#2563EB', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  createBtnDisabled: { backgroundColor: '#93C5FD' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
