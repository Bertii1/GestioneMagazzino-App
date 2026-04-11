// ─── Utente ───────────────────────────────────────────────────────────────────

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator';
  mustChangePassword: boolean;
  loginToken?: string;
  createdAt: string;
}

// ─── Magazzino ────────────────────────────────────────────────────────────────

export interface Warehouse {
  _id: string;
  name: string;
  description?: string;
  gridWidth: number;    // colonne della griglia mappa
  gridHeight: number;   // righe della griglia mappa
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarehouseDto {
  name: string;
  description?: string;
  gridWidth: number;
  gridHeight: number;
}

// ─── Scaffale ─────────────────────────────────────────────────────────────────

export interface Shelf {
  _id: string;
  warehouseId: string | Warehouse;
  code: string;         // es. "A1"
  name?: string;
  x: number;            // colonna sulla griglia
  y: number;            // riga sulla griglia
  levels: number;       // numero di ripiani
  capacity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShelfDto {
  code: string;
  name?: string;
  x: number;
  y: number;
  levels: number;
  capacity?: number;
}

// ─── Prodotto ─────────────────────────────────────────────────────────────────

export type ProductCondition = 'nuovo' | 'usato' | 'vuoto';

export interface Product {
  _id: string;
  barcode: string;
  name: string;
  description?: string;
  color?: string;       // variante colore/finitura (es. "Nero", "Silver")
  brand?: string;       // marca del prodotto
  condition: ProductCondition;
  photos: string[];
  details?: Record<string, unknown>;
  warehouseId: string | Warehouse;
  shelfId: string | Shelf;
  level: number;        // ripiano (1-based)
  slot?: string;        // posizione sul ripiano
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  barcode: string;
  name: string;
  description?: string;
  color?: string;
  brand?: string;
  condition?: ProductCondition;
  details?: Record<string, unknown>;
  warehouseId: string;
  shelfId: string;
  level: number;
  slot?: string;
  quantity: number;
}

export type UpdateProductDto = Partial<CreateProductDto>;

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  errors?: { msg: string; param: string }[];
}

export interface AuthResponse {
  token: string;
  user: User;
  mustChangePassword?: boolean;
}

// ─── Navigazione ──────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  ChangePassword: undefined;
  MainTabs: undefined;
  AdminPanel: undefined;
  WarehouseMap: { warehouseId: string; warehouseName: string };
  ShelfDetail: { shelfId: string; warehouseId: string; levelFocus?: number };
  ProductDetail: { productId: string };
  ProductForm: { productId?: string; shelfId?: string; warehouseId?: string; barcode?: string; level?: number };
  ScanBarcode: undefined;
  ShelfQR: { shelfId: string; shelfCode: string; shelfName?: string; warehouseId: string; level: number };
  BatchQRPrint: { warehouseId: string; warehouseName: string };
  MyQRCode: undefined;
};
