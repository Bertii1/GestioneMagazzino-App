import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shelf } from "../types";

interface Props {
  gridWidth: number;
  gridHeight: number;
  shelves: Shelf[];
  selectedShelfId?: string;
  selectedCell?: { x: number; y: number };
  onShelfPress?: (shelf: Shelf) => void;
  onCellPress?: (x: number, y: number) => void;
}

const CELL_SIZE = 62;

export default function WarehouseMap({
  gridWidth,
  gridHeight,
  shelves,
  selectedShelfId,
  selectedCell,
  onShelfPress,
  onCellPress,
}: Props) {
  const shelfMap = new Map<string, Shelf>();
  for (const s of shelves) {
    shelfMap.set(`${s.x},${s.y}`, s);
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.outerScroll}
    >
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <View style={styles.grid}>
          {/* Riga etichette colonne */}
          <View style={styles.row}>
            <View style={styles.labelCorner} />
            {Array.from({ length: gridWidth }).map((_, col) => (
              <View key={`col-${col}`} style={styles.colLabel}>
                <Text style={styles.labelText}>
                  {String.fromCharCode(65 + col)}
                </Text>
              </View>
            ))}
          </View>

          {/* Righe della griglia */}
          {Array.from({ length: gridHeight }).map((_, row) => (
            <View key={`row-${row}`} style={styles.row}>
              {/* Etichetta riga */}
              <View style={styles.rowLabel}>
                <Text style={styles.labelText}>{row + 1}</Text>
              </View>

              {/* Celle */}
              {Array.from({ length: gridWidth }).map((_, col) => {
                const shelf = shelfMap.get(`${col},${row}`);
                const isCellSelected =
                  !shelf && selectedCell?.x === col && selectedCell?.y === row;

                if (shelf) {
                  const isSelected = shelf._id === selectedShelfId;
                  return (
                    <TouchableOpacity
                      key={`cell-${col}-${row}`}
                      style={[
                        styles.cell,
                        styles.shelfCell,
                        isSelected && styles.shelfCellSelected,
                      ]}
                      onPress={() => onShelfPress?.(shelf)}
                      activeOpacity={0.7}
                      delayPressIn={0}
                    >
                      {/* Linee ripiani decorative */}
                      <View style={styles.shelfLines}>
                        {Array.from({ length: Math.min(shelf.levels, 4) }).map(
                          (_, i) => (
                            <View
                              key={i}
                              style={[
                                styles.shelfLine,
                                isSelected && styles.shelfLineSelected,
                              ]}
                            />
                          ),
                        )}
                      </View>
                      <Text
                        style={[
                          styles.shelfCode,
                          isSelected && styles.shelfCodeSelected,
                        ]}
                      >
                        {shelf.code}
                      </Text>
                    </TouchableOpacity>
                  );
                }

                return (
                  <TouchableOpacity
                    key={`cell-${col}-${row}`}
                    style={[
                      styles.cell,
                      styles.emptyCell,
                      isCellSelected && styles.emptyCellSelected,
                    ]}
                    onPress={() => onCellPress?.(col, row)}
                    activeOpacity={0.6}
                    delayPressIn={0}
                  >
                    <Ionicons
                      name="add"
                      size={isCellSelected ? 18 : 14}
                      color={isCellSelected ? "#D97706" : "#D1D5DB"}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  outerScroll: { flex: 1 },
  grid: { padding: 8 },
  row: { flexDirection: "row" },

  labelCorner: { width: 24, height: 24 },
  colLabel: {
    width: CELL_SIZE,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  rowLabel: {
    width: 20,
    height: CELL_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  labelText: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },

  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 0.5,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyCell: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  emptyCellSelected: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 2,
  },

  shelfCell: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
    borderWidth: 2,
    borderRadius: 6,
  },
  shelfCellSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#1D4ED8",
  },

  shelfLines: {
    flex: 1,
    justifyContent: "space-evenly",
    width: "75%",
    paddingVertical: 4,
  },
  shelfLine: {
    height: 2,
    backgroundColor: "#60A5FA",
    borderRadius: 1,
  },
  shelfLineSelected: {
    backgroundColor: "#BFDBFE",
  },

  shelfCode: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1D4ED8",
    marginBottom: 3,
  },
  shelfCodeSelected: {
    color: "#fff",
  },
});
