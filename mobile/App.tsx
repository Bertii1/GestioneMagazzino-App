import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import Constants from 'expo-constants';
import AppNavigator from './src/navigation/AppNavigator';
import { checkForUpdate, openDownloadUrl, VersionInfo } from './src/services/updateService';

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string) || '';

export default function App() {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setHidden(true);
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent');
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    }
  }, []);

  useEffect(() => {
    if (!API_URL) return;
    checkForUpdate(API_URL)
      .then((info) => { if (info?.updateAvailable) setUpdateInfo(info); })
      .catch(() => {});
  }, []);

  const handleUpdate = () => {
    if (updateInfo?.downloadUrl) openDownloadUrl(updateInfo.downloadUrl);
  };

  const handleDismiss = () => {
    if (!updateInfo?.forceUpdate) setUpdateInfo(null);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar hidden />
      <AppNavigator />
      {updateInfo && (
        <Modal transparent animationType="fade" visible statusBarTranslucent>
          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.title}>Aggiornamento disponibile</Text>
              <Text style={styles.body}>
                Versione {updateInfo.version} disponibile.{updateInfo.forceUpdate ? '\nAggiornamento obbligatorio.' : ''}
              </Text>
              <Pressable style={styles.btnPrimary} onPress={handleUpdate}>
                <Text style={styles.btnPrimaryText}>Scarica e installa</Text>
              </Pressable>
              {!updateInfo.forceUpdate && (
                <Pressable style={styles.btnSecondary} onPress={handleDismiss}>
                  <Text style={styles.btnSecondaryText}>Più tardi</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Modal>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  body: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  btnPrimary: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  btnSecondary: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  btnSecondaryText: {
    color: '#64748b',
    fontSize: 14,
  },
});
