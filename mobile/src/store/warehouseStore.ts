import { create } from 'zustand';
import { Warehouse, Shelf } from '../types';

interface WarehouseState {
  selectedWarehouse: Warehouse | null;
  shelves: Shelf[];

  setSelectedWarehouse: (warehouse: Warehouse | null) => void;
  setShelves: (shelves: Shelf[]) => void;
}

export const useWarehouseStore = create<WarehouseState>((set) => ({
  selectedWarehouse: null,
  shelves: [],

  setSelectedWarehouse: (warehouse) => set({ selectedWarehouse: warehouse }),
  setShelves: (shelves) => set({ shelves }),
}));
