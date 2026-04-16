import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Print from 'expo-print';
import { shelfService } from '../../services/shelfService';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../types';
import { SHELF_QR_PREFIX } from './ShelfQRScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'BatchQRPrint'>;

interface LevelItem {
  shelfId: string;
  shelfCode: string;
  shelfName?: string;
  level: number;
  selected: boolean;
}

export default function BatchQRPrintScreen({ route }: Props) {
  const { warehouseId } = route.params;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LevelItem[]>([]);
  const [printing, setPrinting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const shelves = await shelfService.getByWarehouse(warehouseId);
          const all: LevelItem[] = [];
          for (const shelf of shelves) {
            for (let l = 1; l <= shelf.levels; l++) {
              all.push({
                shelfId: shelf._id,
                shelfCode: shelf.code,
                shelfName: shelf.name,
                level: l,
                selected: true,
              });
            }
          }
          setItems(all);
        } catch {
          Alert.alert('Errore', 'Impossibile caricare gli scaffali');
        } finally {
          setLoading(false);
        }
      };
      load();
    }, [warehouseId])
  );

  const toggleItem = (idx: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
  };

  const toggleAll = (value: boolean) => {
    setItems(prev => prev.map(it => ({ ...it, selected: value })));
  };

  const handlePrint = async () => {
    const selected = items.filter(it => it.selected);
    if (selected.length === 0) {
      Alert.alert('Nessun ripiano selezionato', 'Seleziona almeno un ripiano da stampare.');
      return;
    }
    setPrinting(true);
    try {
      const cards = selected.map((item) => ({
        ...item,
        value: `${SHELF_QR_PREFIX}${item.shelfId}/level/${item.level}`,
      }));
      const html = buildHTML(cards);
      await Print.printAsync({ html });
    } catch (err) {
      Alert.alert('Errore', 'Impossibile generare la stampa');
      console.error(err);
    } finally {
      setPrinting(false);
    }
  };

  const selectedCount = items.filter(it => it.selected).length;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.selBar}>
        <Text style={styles.selText}>{selectedCount} / {items.length} ripiani selezionati</Text>
        <View style={styles.selActions}>
          <TouchableOpacity onPress={() => toggleAll(true)} style={styles.selLink}>
            <Text style={styles.selLinkText}>Tutti</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => toggleAll(false)} style={styles.selLink}>
            <Text style={styles.selLinkText}>Nessuno</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.row} onPress={() => toggleItem(index)} activeOpacity={0.7}>
            <View style={[styles.checkbox, item.selected && styles.checkboxOn]}>
              {item.selected && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Scaffale {item.shelfCode}</Text>
              {item.shelfName ? (
                <Text style={styles.rowName}>{item.shelfName}</Text>
              ) : null}
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Ripiano {item.level}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.printBtn, (printing || selectedCount === 0) && styles.printBtnDisabled]}
          onPress={handlePrint}
          disabled={printing || selectedCount === 0}
        >
          {printing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="print-outline" size={20} color="#fff" />
              <Text style={styles.printBtnText}>Stampa {selectedCount} barcode</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function buildHTML(
  cards: Array<{ shelfCode: string; shelfName?: string; level: number; value: string }>
): string {
  const barcodeInits = cards
    .map((c, i) => `JsBarcode('#bc${i}', ${JSON.stringify(c.value)}, {format:'CODE128',width:1.8,height:60,margin:6,displayValue:false});`)
    .join('\n    ');

  const cardsHTML = cards
    .map(
      (c, i) => `
    <div class="card">
      <svg id="bc${i}"></svg>
      <p class="label">Scaffale ${c.shelfCode} · Ripiano ${c.level}</p>
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: white; padding: 12px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .card {
    text-align: center; padding: 10px;
    border: 1px solid #e5e7eb; border-radius: 8px;
    break-inside: avoid; page-break-inside: avoid;
  }
  svg { display: block; margin: 0 auto; }
  .label { font-size: 11px; color: #6b7280; margin-top: 6px; }
</style>
</head>
<body>
  <div class="grid">${cardsHTML}</div>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <script>
    window.onload = function() {
      ${barcodeInits}
    };
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  selBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#EFF6FF', borderBottomWidth: 1, borderBottomColor: '#DBEAFE',
  },
  selText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  selActions: { flexDirection: 'row', gap: 16 },
  selLink: { padding: 4 },
  selLinkText: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
  list: { padding: 12, paddingBottom: 100 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    marginBottom: 8, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  checkboxOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowName: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  levelBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  levelBadgeText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  printBtn: {
    backgroundColor: '#2563EB', borderRadius: 10,
    padding: 16, alignItems: 'center',
  },
  printBtnDisabled: { backgroundColor: '#93C5FD' },
  printBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
