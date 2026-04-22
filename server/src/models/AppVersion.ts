import mongoose, { Document, Schema } from 'mongoose';

interface IAppVersion extends Document {
  platform: string;
  version: string;
  buildNumber: number;
  downloadUrl: string;
  minVersion: string;
}

const schema = new Schema<IAppVersion>(
  {
    platform: { type: String, required: true, unique: true },
    version: { type: String, required: true },
    buildNumber: { type: Number, default: 1 },
    downloadUrl: { type: String, required: true },
    minVersion: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IAppVersion>('AppVersion', schema);
