import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Svg, { Rect, Text as SvgText, G, Line } from 'react-native-svg';
import { Shelf } from '../types';

interface Props {
  gridWidth: number;
  gridHeight: number;
  shelves: Shelf[];
  selectedShelfId?: string;
  selectedCell?: { x: number; y: number };   // cella vuota selezionata
  onShelfPress?: (shelf: Shelf) => void;
  onCellPress?: (x: number, y: number) => void; // tap su cella vuota
}

const CELL_SIZE = 52;
const PADDING = 8;
const LABEL_SIZE = 18;

export default function WarehouseMap({
  gridWidth,
  gridHeight,
  shelves,
  selectedShelfId,
  selectedCell,
  onShelfPress,
  onCellPress,
}: Props) {
  const svgWidth = gridWidth * CELL_SIZE + PADDING * 2 + LABEL_SIZE;
  const svgHeight = gridHeight * CELL_SIZE + PADDING * 2 + LABEL_SIZE;

  // Mappa posizione → scaffale per O(1) lookup
  const shelfMap = new Map<string, Shelf>();
  for (const s of shelves) {
    shelfMap.set(`${s.x},${s.y}`, s);
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <Svg width={svgWidth} height={svgHeight}>

            {/* ── Celle della griglia ───────────────────────────────────── */}
            {Array.from({ length: gridHeight }).map((_, row) =>
              Array.from({ length: gridWidth }).map((_, col) => {
                const px = PADDING + LABEL_SIZE + col * CELL_SIZE;
                const py = PADDING + LABEL_SIZE + row * CELL_SIZE;
                const hasShelf = shelfMap.has(`${col},${row}`);
                const isCellSelected =
                  !hasShelf &&
                  selectedCell?.x === col &&
                  selectedCell?.y === row;

                if (hasShelf) {
                  // Cella occupata: solo sfondo (lo scaffale verrà disegnato dopo)
                  return (
                    <Rect
                      key={`cell-${col}-${row}`}
                      x={px} y={py}
                      width={CELL_SIZE} height={CELL_SIZE}
                      fill="#EFF6FF" stroke="#E5E7EB" strokeWidth={1}
                    />
                  );
                }

                // Cella vuota — cliccabile
                return (
                  <G
                    key={`cell-${col}-${row}`}
                    onPress={() => onCellPress?.(col, row)}
                  >
                    <Rect
                      x={px} y={py}
                      width={CELL_SIZE} height={CELL_SIZE}
                      fill={isCellSelected ? '#FEF3C7' : '#F9FAFB'}
                      stroke={isCellSelected ? '#F59E0B' : '#E5E7EB'}
                      strokeWidth={isCellSelected ? 2 : 1}
                    />
                    {/* Icona "+" al centro per indicare che è creabile */}
                    <SvgText
                      x={px + CELL_SIZE / 2}
                      y={py + CELL_SIZE / 2 + 5}
                      fontSize={isCellSelected ? 22 : 16}
                      fill={isCellSelected ? '#D97706' : '#D1D5DB'}
                      textAnchor="middle"
                    >
                      +
                    </SvgText>
                  </G>
                );
              })
            )}

            {/* ── Etichette colonne (A, B, C…) ─────────────────────────── */}
            {Array.from({ length: gridWidth }).map((_, col) => (
              <SvgText
                key={`col-label-${col}`}
                x={PADDING + LABEL_SIZE + col * CELL_SIZE + CELL_SIZE / 2}
                y={PADDING + LABEL_SIZE - 4}
                fontSize={11} fill="#9CA3AF"
                textAnchor="middle"
              >
                {String.fromCharCode(65 + col)}
              </SvgText>
            ))}

            {/* ── Etichette righe (1, 2, 3…) ──────────────────────────── */}
            {Array.from({ length: gridHeight }).map((_, row) => (
              <SvgText
                key={`row-label-${row}`}
                x={PADDING + LABEL_SIZE - 4}
                y={PADDING + LABEL_SIZE + row * CELL_SIZE + CELL_SIZE / 2 + 4}
                fontSize={11} fill="#9CA3AF"
                textAnchor="middle"
              >
                {row + 1}
              </SvgText>
            ))}

            {/* ── Scaffali ──────────────────────────────────────────────── */}
            {shelves.map((shelf) => {
              const x = PADDING + LABEL_SIZE + shelf.x * CELL_SIZE;
              const y = PADDING + LABEL_SIZE + shelf.y * CELL_SIZE;
              const isSelected = shelf._id === selectedShelfId;

              return (
                <G key={shelf._id} onPress={() => onShelfPress?.(shelf)}>
                  <Rect
                    x={x + 2} y={y + 2}
                    width={CELL_SIZE - 4} height={CELL_SIZE - 4}
                    rx={6} ry={6}
                    fill={isSelected ? '#2563EB' : '#DBEAFE'}
                    stroke={isSelected ? '#1D4ED8' : '#93C5FD'}
                    strokeWidth={2}
                  />
                  {/* Linee ripiani */}
                  {Array.from({ length: Math.min(shelf.levels, 3) }).map((_, i) => {
                    const lineY = y + 10 + i * ((CELL_SIZE - 16) / Math.min(shelf.levels, 3));
                    return (
                      <Line
                        key={`line-${shelf._id}-${i}`}
                        x1={x + 8} y1={lineY}
                        x2={x + CELL_SIZE - 8} y2={lineY}
                        stroke={isSelected ? '#BFDBFE' : '#60A5FA'}
                        strokeWidth={1.5}
                      />
                    );
                  })}
                  {/* Codice scaffale */}
                  <SvgText
                    x={x + CELL_SIZE / 2}
                    y={y + CELL_SIZE - 8}
                    fontSize={11} fontWeight="600"
                    fill={isSelected ? '#fff' : '#1D4ED8'}
                    textAnchor="middle"
                  >
                    {shelf.code}
                  </SvgText>
                </G>
              );
            })}

          </Svg>
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 4 },
});
