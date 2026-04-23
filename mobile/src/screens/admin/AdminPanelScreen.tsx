import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, FlatList, ActivityIndicator, Modal, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, User } from '../../types';
import { adminService } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminPanel'>;

export default function AdminPanelScreen({ navigation }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState<User | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminService.listUsers();
      setUsers(data);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare la lista utenti');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadUsers(); }, [loadUsers]));

  const handleDelete = (user: User) => {
    Alert.alert(
      'Elimina utente',
      `Sei sicuro di voler eliminare ${user.name}?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminService.deleteUser(user._id);
              setUsers((prev) => prev.filter((u) => u._id !== user._id));
            } catch {
              Alert.alert('Errore', 'Impossibile eliminare l\'utente');
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }: { item: User }) => {
    const isMe = item._id === currentUser?._id;
    return (
      <View style={styles.userCard}>
        <View style={styles.userInfo}>
          <View style={styles.userHeader}>
            <Text style={styles.userName}>{item.name}</Text>
            <View style={[styles.roleBadge, item.role === 'admin' && styles.roleBadgeAdmin]}>
              <Text style={[styles.roleText, item.role === 'admin' && styles.roleTextAdmin]}>
                {item.role}
              </Text>
            </View>
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.mustChangePassword && (
            <Text style={styles.mustChange}>Deve cambiare password</Text>
          )}
        </View>
        {!isMe && (
          <View style={styles.userActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setShowResetModal(item)}
            >
              <Ionicons name="key-outline" size={18} color="#2563EB" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestione Utenti</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="person-add-outline" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Nuovo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u._id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Nessun utente trovato</Text>
          }
        />
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={() => Alert.alert('Logout', 'Sei sicuro di voler uscire?', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Esci', style: 'destructive', onPress: logout },
      ])}>
        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        <Text style={styles.logoutText}>Esci</Text>
      </TouchableOpacity>

      <CreateUserModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(user) => {
          setUsers((prev) => [user, ...prev]);
          setShowCreateModal(false);
        }}
      />

      <ResetPasswordModal
        visible={!!showResetModal}
        user={showResetModal}
        onClose={() => setShowResetModal(null)}
      />
    </View>
  );
}

// ── Modal: Crea utente ────────────────────────────────────────────────────────

function CreateUserModal({
  visible, onClose, onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (user: User) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'operator' | 'admin'>('operator');
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(''); setEmail(''); setPassword(''); setRole('operator'); };

  const handleCreate = async () => {
    if (!name || !email || !password) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Errore', 'La password deve avere almeno 6 caratteri');
      return;
    }
    setSaving(true);
    try {
      const user = await adminService.createUser(name.trim(), email.trim(), password, role);
      onCreated(user);
      reset();
      Alert.alert(
        'Utente creato',
        `Comunica le credenziali a ${name}:\n\nEmail: ${email}\nPassword: ${password}\n\nAl primo accesso dovrà cambiarla.`
      );
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Errore durante la creazione';
      Alert.alert('Errore', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuovo Utente</Text>

            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome completo" />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input} value={email} onChangeText={setEmail}
              placeholder="email@esempio.it" keyboardType="email-address" autoCapitalize="none"
            />

            <Text style={styles.label}>Password temporanea</Text>
            <TextInput
              style={styles.input} value={password} onChangeText={setPassword}
              placeholder="Minimo 6 caratteri"
            />

            <Text style={styles.label}>Ruolo</Text>
            <View style={styles.roleRow}>
              {(['operator', 'admin'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                    {r === 'operator' ? 'Operatore' : 'Admin'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { reset(); onClose(); }}>
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, saving && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                <Text style={styles.modalConfirmText}>
                  {saving ? 'Creazione...' : 'Crea Utente'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Modal: Reset password ─────────────────────────────────────────────────────

function ResetPasswordModal({
  visible, user, onClose,
}: {
  visible: boolean;
  user: User | null;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReset = async () => {
    if (!user) return;
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Errore', 'La password deve avere almeno 6 caratteri');
      return;
    }
    setSaving(true);
    try {
      await adminService.resetUserPassword(user._id, newPassword);
      Alert.alert(
        'Password reimpostata',
        `Comunica la nuova password a ${user.name}:\n\n${newPassword}\n\nDovrà cambiarla al prossimo accesso.`
      );
      setNewPassword('');
      onClose();
    } catch {
      Alert.alert('Errore', 'Impossibile reimpostare la password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Reset Password</Text>
          <Text style={styles.modalSubtitle}>{user?.name}</Text>

          <Text style={styles.label}>Nuova password temporanea</Text>
          <TextInput
            style={styles.input} value={newPassword} onChangeText={setNewPassword}
            placeholder="Minimo 6 caratteri"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => { setNewPassword(''); onClose(); }}>
              <Text style={styles.modalCancelText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirm, saving && styles.btnDisabled]}
              onPress={handleReset}
              disabled={saving}
            >
              <Text style={styles.modalConfirmText}>
                {saving ? 'Reset...' : 'Reimposta'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Stili ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  list: { padding: 16, paddingTop: 0, gap: 10 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 15 },

  // User card
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  userInfo: { flex: 1 },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  userEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  mustChange: { fontSize: 12, color: '#F59E0B', fontWeight: '500', marginTop: 4 },
  roleBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  roleBadgeAdmin: { backgroundColor: '#EFF6FF' },
  roleText: { fontSize: 11, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' },
  roleTextAdmin: { color: '#2563EB' },
  userActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 14, marginHorizontal: 16, marginBottom: 24,
    borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 10, backgroundColor: '#FEF2F2',
  },
  logoutText: { color: '#DC2626', fontWeight: '600', fontSize: 15 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', padding: 20,
  },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancel: {
    flex: 1, borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10,
    padding: 14, alignItems: 'center', backgroundColor: '#fff',
  },
  modalCancelText: { color: '#374151', fontWeight: '600', fontSize: 15 },
  modalConfirm: {
    flex: 1, backgroundColor: '#2563EB', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },

  // Form
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: '#F9FAFB',
  },
  roleRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  roleChip: {
    flex: 1, borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 8,
    padding: 12, alignItems: 'center', backgroundColor: '#fff',
  },
  roleChipActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  roleChipText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  roleChipTextActive: { color: '#2563EB' },
});
