import mongoose, { Document, Schema } from 'mongoose';

export interface IWarehouse extends Document {
  name: string;
  description?: string;
  gridWidth: number;   // numero di colonne della griglia mappa
  gridHeight: number;  // numero di righe della griglia mappa
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseSchema = new Schema<IWarehouse>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    gridWidth: { type: Number, required: true, min: 1, default: 10 },
    gridHeight: { type: Number, required: true, min: 1, default: 10 },
  },
  { timestamps: true }
);

export default mongoose.model<IWarehouse>('Warehouse', WarehouseSchema);
