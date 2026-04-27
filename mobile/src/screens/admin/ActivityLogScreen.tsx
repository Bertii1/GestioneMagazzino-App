import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityLog } from '../../types';
import { activityService } from '../../services/activityService';

const ACTION_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  login:              { label: 'Accesso',             icon: 'log-in-outline',       color: '#10B981' },
  logout:             { label: 'Disconnessione',       icon: 'log-out-outline',      color: '#6B7280' },
  qr_login:           { label: 'Accesso QR',           icon: 'qr-code-outline',      color: '#10B981' },
  change_password:    { label: 'Cambio password',      icon: 'key-outline',          color: '#F59E0B' },
  create_product:     { label: 'Prodotto creato',      icon: 'add-circle-outline',   color: '#2563EB' },
  update_product:     { label: 'Prodotto aggiornato',  icon: 'pencil-outline',       color: '#F59E0B' },
  delete_product:     { label: 'Prodotto eliminato',   icon: 'trash-outline',        color: '#DC2626' },
  create_warehouse:   { label: 'Magazzino creato',     icon: 'add-circle-outline',   color: '#2563EB' },
  update_warehouse:   { label: 'Magazzino aggiornato', icon: 'pencil-outline',       color: '#F59E0B' },
  delete_warehouse:   { label: 'Magazzino eliminato',  icon: 'trash-outline',        color: '#DC2626' },
  create_shelf:       { label: 'Scaffale creato',      icon: 'add-circle-outline',   color: '#2563EB' },
  update_shelf:       { label: 'Scaffale aggiornato',  icon: 'pencil-outline',       color: '#F59E0B' },
  delete_shelf:       { label: 'Scaffale eliminato',   icon: 'trash-outline',        color: '#DC2626' },
  create_user:        { label: 'Utente creato',        icon: 'person-add-outline',   color: '#2563EB' },
  delete_user:        { label: 'Utente eliminato',     icon: 'person-remove-outline',color: '#DC2626' },
  reset_password:     { label: 'Password reimpostata', icon: 'refresh-outline',      color: '#F59E0B' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Adesso';
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ore fa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} giorni fa`;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function LogItem({ item }: { item: ActivityLog }) {
  const cfg = ACTION_CONFIG[item.action] ?? { label: item.action, icon: 'ellipse-outline' as keyof typeof Ionicons.glyphMap, color: '#6B7280' };
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: cfg.color + '18' }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.action}>{cfg.label}</Text>
          <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text style={styles.user}>{item.userName} · {item.userEmail}</Text>
        {item.entityName ? (
          <Text style={styles.entity}>{item.entityName}</Text>
        ) : null}
        {item.ip && item.ip !== 'unknown' ? (
          <Text style={styles.ip}>{item.ip}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ActivityLogScreen() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 50;

  const load = useCallback(async (p: number, replace: boolean) => {
    try {
      const res = await activityService.getLogs(p, LIMIT);
      setTotal(res.total);
      setLogs((prev) => replace ? res.logs : [...prev, ...res.logs]);
      setPage(p);
    } catch {
      // silenzioso
    }
  }, []);

  useEffect(() => {
    load(1, true).finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(1, true);
    setRefreshing(false);
  };

  const onLoadMore = async () => {
    if (loadingMore || logs.length >= total) return;
    setLoadingMore(true);
    await load(page + 1, false);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.counter}>{total} eventi totali</Text>
      <FlatList
        data={logs}
        keyExtractor={(l) => l._id}
        renderItem={({ item }) => <LogItem item={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#2563EB" style={{ marginVertical: 16 }} /> : null}
        ListEmptyComponent={<Text style={styles.empty}>Nessuna attività registrata</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  counter: { fontSize: 12, color: '#9CA3AF', textAlign: 'right', paddingHorizontal: 16, paddingVertical: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 60, fontSize: 15 },

  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  content: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { fontSize: 14, fontWeight: '600', color: '#111827' },
  time: { fontSize: 12, color: '#9CA3AF' },
  user: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  entity: { fontSize: 12, color: '#374151', marginTop: 2, fontWeight: '500' },
  ip: { fontSize: 11, color: '#D1D5DB', marginTop: 2 },
});
