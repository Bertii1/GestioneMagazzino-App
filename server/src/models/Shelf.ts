import mongoose, { Document, Schema } from 'mongoose';

export interface IShelf extends Document {
  warehouseId: mongoose.Types.ObjectId;
  code: string;        // es. "A1", "B3" — univoco per magazzino
  name?: string;
  x: number;           // colonna sulla griglia mappa
  y: number;           // riga sulla griglia mappa
  levels: number;      // numero di ripiani
  capacity?: number;   // capacità totale (slot per ripiano)
  createdAt: Date;
  updatedAt: Date;
}

const ShelfSchema = new Schema<IShelf>(
  {
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, trim: true },
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
    levels: { type: Number, required: true, min: 1, default: 3 },
    capacity: { type: Number, min: 1 },
  },
  { timestamps: true }
);

// Codice univoco per magazzino
ShelfSchema.index({ warehouseId: 1, code: 1 }, { unique: true });

export default mongoose.model<IShelf>('Shelf', ShelfSchema);
