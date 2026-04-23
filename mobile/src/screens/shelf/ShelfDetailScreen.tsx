import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, Product, Shelf } from "../../types";
import { shelfService } from "../../services/shelfService";
import { productService } from "../../services/productService";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "ShelfDetail">;

export default function ShelfDetailScreen({ route, navigation }: Props) {
  const { shelfId, warehouseId, levelFocus } = route.params;
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag & Drop tra ripiani
  const [movingProduct, setMovingProduct] = useState<Product | null>(null);

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
      Alert.alert("Errore", "Impossibile caricare i dati dello scaffale");
    } finally {
      setLoading(false);
    }
  }, [shelfId]);

  useFocusEffect(
    useCallback(() => {
      didScrollRef.current = false;
      loadData();
    }, [loadData]),
  );

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
    Alert.alert("Elimina prodotto", `Eliminare "${product.name}"?`, [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: async () => {
          try {
            await productService.delete(product._id);
            setProducts((prev) => prev.filter((p) => p._id !== product._id));
          } catch {
            Alert.alert("Errore", "Impossibile eliminare il prodotto");
          }
        },
      },
    ]);
  };

  const handleMoveToLevel = async (targetLevel: number) => {
    if (!movingProduct) return;
    if (movingProduct.level === targetLevel) {
      setMovingProduct(null);
      return;
    }
    try {
      await productService.update(movingProduct._id, { level: targetLevel });
      setProducts((prev) =>
        prev.map((p) =>
          p._id === movingProduct._id ? { ...p, level: targetLevel } : p,
        ),
      );
    } catch {
      Alert.alert("Errore", "Impossibile spostare il prodotto");
    } finally {
      setMovingProduct(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
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

      {/* Banner spostamento attivo */}
      {movingProduct && (
        <View style={styles.moveBanner}>
          <View style={styles.moveBannerContent}>
            <Ionicons name="move-outline" size={18} color="#2563EB" />
            <Text style={styles.moveBannerText} numberOfLines={1}>
              Sposta "{movingProduct.name}" — tocca un ripiano
            </Text>
          </View>
          <TouchableOpacity onPress={() => setMovingProduct(null)}>
            <Text style={styles.moveBannerCancel}>Annulla</Text>
          </TouchableOpacity>
        </View>
      )}

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
          const isDropTarget = !!movingProduct && movingProduct.level !== level;
          const isSourceLevel =
            !!movingProduct && movingProduct.level === level;
          return (
            <TouchableOpacity
              activeOpacity={isDropTarget ? 0.7 : 1}
              onPress={
                isDropTarget ? () => handleMoveToLevel(level) : undefined
              }
              disabled={!isDropTarget}
            >
              <View
                style={[
                  styles.levelCard,
                  isFocused && styles.levelCardFocused,
                  isDropTarget && styles.levelCardDropTarget,
                  isSourceLevel && styles.levelCardSource,
                ]}
              >
                <View
                  style={[
                    styles.levelHeader,
                    isFocused && styles.levelHeaderFocused,
                    isDropTarget && styles.levelHeaderDropTarget,
                  ]}
                >
                  <View style={styles.levelTitleRow}>
                    {isDropTarget && (
                      <Ionicons
                        name="arrow-down-circle"
                        size={16}
                        color="#2563EB"
                      />
                    )}
                    <Text
                      style={[
                        styles.levelTitle,
                        isFocused && styles.levelTitleFocused,
                        isDropTarget && styles.levelTitleDropTarget,
                      ]}
                    >
                      Ripiano {level}
                    </Text>
                  </View>
                  {!movingProduct && (
                    <View style={styles.levelActions}>
                      <TouchableOpacity
                        style={rowStyles.qrBtn}
                        onPress={() =>
                          navigation.navigate("ShelfQR", {
                            shelfId,
                            shelfCode: shelf.code,
                            shelfName: shelf.name,
                            warehouseId,
                            level,
                          })
                        }
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Ionicons
                            name="qr-code-outline"
                            size={11}
                            color="#fff"
                          />
                          <Text style={rowStyles.qrBtnText}>QR</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={rowStyles.addBtn}
                        onPress={() =>
                          navigation.navigate("ProductForm", {
                            shelfId,
                            warehouseId,
                            level,
                          })
                        }
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Ionicons name="add" size={13} color="#fff" />
                          <Text style={rowStyles.addBtnText}>Prodotto</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                  {isDropTarget && (
                    <Text style={styles.dropHint}>Rilascia qui</Text>
                  )}
                </View>

                {levelProducts.length === 0 ? (
                  <Text style={styles.empty}>
                    {isDropTarget
                      ? "Rilascia qui per spostare"
                      : "Nessun prodotto"}
                  </Text>
                ) : (
                  levelProducts.map((product) => {
                    const isMoving = movingProduct?._id === product._id;
                    return (
                      <View
                        key={product._id}
                        style={[
                          styles.productRow,
                          isMoving && styles.productRowMoving,
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.productInfo}
                          onPress={
                            movingProduct
                              ? undefined
                              : () =>
                                  navigation.navigate("ProductDetail", {
                                    productId: product._id,
                                  })
                          }
                          onLongPress={() => setMovingProduct(product)}
                          delayLongPress={400}
                        >
                          <View style={styles.productNameRow}>
                            <Ionicons
                              name="reorder-three-outline"
                              size={18}
                              color={isMoving ? "#2563EB" : "#D1D5DB"}
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={[
                                styles.productName,
                                isMoving && styles.productNameMoving,
                              ]}
                            >
                              {product.name}
                            </Text>
                            {product.brand ? (
                              <View style={styles.brandTag}>
                                <Text style={styles.brandTagText}>
                                  {product.brand}
                                </Text>
                              </View>
                            ) : null}
                            {product.color ? (
                              <View style={styles.colorTag}>
                                <Text style={styles.colorTagText}>
                                  {product.color}
                                </Text>
                              </View>
                            ) : null}
                            {product.condition && (
                              <View
                                style={[
                                  styles.conditionTag,
                                  product.condition === "nuovo" &&
                                    styles.conditionTagNuovo,
                                  product.condition === "usato" &&
                                    styles.conditionTagUsato,
                                  product.condition === "vuoto" &&
                                    styles.conditionTagVuoto,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.conditionTagText,
                                    product.condition === "nuovo" &&
                                      styles.conditionTagTextNuovo,
                                    product.condition === "usato" &&
                                      styles.conditionTagTextUsato,
                                    product.condition === "vuoto" &&
                                      styles.conditionTagTextVuoto,
                                  ]}
                                >
                                  {product.condition.charAt(0).toUpperCase() +
                                    product.condition.slice(1)}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.productBarcode}>
                            {product.barcode}
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.productRight}>
                          {product.slot && (
                            <Text style={styles.productSlot}>
                              {product.slot}
                            </Text>
                          )}
                          <Text style={styles.productQty}>
                            x {product.quantity}
                          </Text>
                        </View>
                        {!movingProduct && (
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDeleteProduct(product)}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color="#EF4444"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  qrBtn: {
    backgroundColor: "#1D4ED8",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qrBtnText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  addBtn: {
    backgroundColor: "#059669",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 11 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Move banner
  moveBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    borderBottomWidth: 1,
    borderBottomColor: "#BFDBFE",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  moveBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  moveBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1D4ED8",
    flex: 1,
  },
  moveBannerCancel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
    paddingLeft: 12,
  },

  header: {
    backgroundColor: "#EFF6FF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#DBEAFE",
  },
  headerCode: { fontSize: 22, fontWeight: "700", color: "#1D4ED8" },
  headerName: { fontSize: 15, color: "#374151", marginTop: 2 },
  headerMeta: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  list: { padding: 16, paddingBottom: 32 },
  levelCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  levelCardFocused: {
    borderWidth: 2,
    borderColor: "#2563EB",
  },
  levelCardDropTarget: {
    borderWidth: 2,
    borderColor: "#2563EB",
    borderStyle: "dashed",
    backgroundColor: "#EFF6FF",
  },
  levelCardSource: { opacity: 0.6 },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  levelHeaderFocused: {
    backgroundColor: "#EFF6FF",
  },
  levelHeaderDropTarget: {
    backgroundColor: "#DBEAFE",
  },
  levelTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelTitle: { fontWeight: "700", fontSize: 14, color: "#374151" },
  levelTitleFocused: { color: "#1D4ED8" },
  levelTitleDropTarget: { color: "#1D4ED8" },
  dropHint: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
  levelActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  empty: { padding: 16, color: "#9CA3AF", fontSize: 14, textAlign: "center" },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  productRowMoving: {
    backgroundColor: "#DBEAFE",
    borderRadius: 8,
  },
  productInfo: { flex: 1 },
  productNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  productName: { fontSize: 15, fontWeight: "500", color: "#111827" },
  productNameMoving: { color: "#1D4ED8", fontWeight: "700" },
  brandTag: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#DBEAFE",
  },
  brandTagText: { fontSize: 10, fontWeight: "700", color: "#1D4ED8" },
  colorTag: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#EDE9FE",
  },
  colorTagText: { fontSize: 10, fontWeight: "700", color: "#7C3AED" },
  conditionTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  conditionTagNuovo: { backgroundColor: "#DCFCE7" },
  conditionTagUsato: { backgroundColor: "#FEF3C7" },
  conditionTagVuoto: { backgroundColor: "#FEE2E2" },
  conditionTagText: { fontSize: 10, fontWeight: "700" },
  conditionTagTextNuovo: { color: "#16A34A" },
  conditionTagTextUsato: { color: "#D97706" },
  conditionTagTextVuoto: { color: "#DC2626" },
  productBarcode: {
    fontSize: 12,
    color: "#9CA3AF",
    fontFamily: "monospace",
    marginTop: 2,
  },
  productRight: { alignItems: "flex-end", marginRight: 8 },
  productSlot: {
    fontSize: 12,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  productQty: { fontSize: 13, fontWeight: "600", color: "#059669" },
  deleteBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
  },
  deleteBtnText: { fontSize: 13, color: "#EF4444", fontWeight: "700" },
});
