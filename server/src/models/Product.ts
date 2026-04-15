import mongoose, { Document, Schema } from 'mongoose';

export type ProductCondition = 'nuovo' | 'usato' | 'vuoto';

export interface IProduct extends Document {
  barcode: string;                        // codice a barre univoco
  name: string;
  description?: string;
  color?: string;                         // variante colore/finitura (es. "Nero", "Silver")
  brand?: string;                         // marca del prodotto
  category?: string;                      // categoria del prodotto
  condition: ProductCondition;            // stato del prodotto
  photos: string[];                       // nomi file foto (serviti da /uploads/products/)
  details?: Map<string, unknown>;         // campi flessibili aggiuntivi
  warehouseId: mongoose.Types.ObjectId;
  shelfId: mongoose.Types.ObjectId;
  level: number;                          // ripiano (1-based)
  slot?: string;                          // posizione sul ripiano (es. "L1", "C2")
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    barcode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    color: { type: String, trim: true },
    brand: { type: String, trim: true },
    category: { type: String, trim: true },
    condition: { type: String, enum: ['nuovo', 'usato', 'vuoto'], default: 'nuovo' },
    photos: { type: [String], default: [] },
    details: { type: Map, of: Schema.Types.Mixed },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    shelfId: { type: Schema.Types.ObjectId, ref: 'Shelf', required: true },
    level: { type: Number, required: true, min: 1 },
    slot: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

// Indici per ricerche frequenti
ProductSchema.index({ warehouseId: 1 });
ProductSchema.index({ shelfId: 1, level: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

export default mongoose.model<IProduct>('Product', ProductSchema);
