import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../types";
import { useAuthStore } from "../../store/authStore";
import { authService } from "../../services/authService";

type Props = NativeStackScreenProps<RootStackParamList, "MyQRCode">;

const QR_PREFIX = "magazzino://login/";

export default function MyQRCodeScreen({ navigation }: Props) {
  const { user, pendingQrToken, clearPendingQr } = useAuthStore();
  const [loginToken, setLoginToken] = useState<string | null>(
    pendingQrToken ?? null,
  );
  const [loading, setLoading] = useState(!pendingQrToken);
  const [regenerating, setRegenerating] = useState(false);
  const isFirstAccess = !!pendingQrToken;

  useEffect(() => {
    if (!loginToken) {
      authService
        .getQrToken()
        .then(setLoginToken)
        .catch(() => Alert.alert("Errore", "Impossibile caricare il QR code"))
        .finally(() => setLoading(false));
    }
  }, []);

  const handleRegenerate = () => {
    Alert.alert(
      "Rigenera QR code",
      "Il vecchio QR code non funzionerà più. Continuare?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Rigenera",
          style: "destructive",
          onPress: async () => {
            setRegenerating(true);
            try {
              const newToken = await authService.regenerateQrToken();
              setLoginToken(newToken);
            } catch {
              Alert.alert("Errore", "Impossibile rigenerare il QR code");
            } finally {
              setRegenerating(false);
            }
          },
        },
      ],
    );
  };

  const handleDismiss = () => {
    if (isFirstAccess) {
      clearPendingQr();
      navigation.replace("MainTabs");
    } else {
      navigation.goBack();
    }
  };

  const qrValue = loginToken ? `${QR_PREFIX}${loginToken}` : "";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {isFirstAccess && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Questo è il tuo QR code personale.{"\n"}
            Salvalo: ti permetterà di accedere senza password.
          </Text>
        </View>
      )}

      <Text style={styles.title}>Il tuo QR code</Text>
      <Text style={styles.subtitle}>{user?.name}</Text>

      <View style={styles.qrCard}>
        {loading ? (
          <ActivityIndicator size="large" color="#2563EB" />
        ) : (
          <QRCode
            value={qrValue}
            size={220}
            color="#111827"
            backgroundColor="#fff"
          />
        )}
      </View>

      <Text style={styles.hint}>
        Scansiona questo codice dalla schermata di login per accedere
        direttamente.
      </Text>

      <TouchableOpacity
        style={[styles.btnSecondary, regenerating && styles.btnDisabled]}
        onPress={handleRegenerate}
        disabled={regenerating || loading}
      >
        {regenerating ? (
          <ActivityIndicator color="#374151" />
        ) : (
          <Text style={styles.btnSecondaryText}>Rigenera QR code</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnPrimary} onPress={handleDismiss}>
        <Text style={styles.btnPrimaryText}>
          {isFirstAccess ? "Ho salvato il QR — Continua" : "Chiudi"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F9FAFB",
    padding: 24,
    alignItems: "center",
  },
  banner: {
    width: "100%",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
    padding: 14,
    marginBottom: 24,
  },
  bannerText: { color: "#1E40AF", fontSize: 14, lineHeight: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 4 },
  subtitle: { fontSize: 15, color: "#6B7280", marginBottom: 28 },
  qrCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 20,
    minHeight: 276,
    justifyContent: "center",
    alignItems: "center",
  },
  hint: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  btnPrimary: {
    width: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  btnPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnSecondary: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  btnSecondaryText: { color: "#374151", fontSize: 15, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
});
