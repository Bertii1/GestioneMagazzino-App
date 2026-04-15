import mongoose, { Document, Schema } from 'mongoose';

export interface IProductCatalog extends Document {
  barcode: string;
  name: string;
  description?: string;
  color?: string;
  brand?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductCatalogSchema = new Schema<IProductCatalog>(
  {
    barcode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    color: { type: String, trim: true },
    brand: { type: String, trim: true },
    category: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model<IProductCatalog>('ProductCatalog', ProductCatalogSchema);
