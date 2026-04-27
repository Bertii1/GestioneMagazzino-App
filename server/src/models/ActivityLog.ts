import mongoose, { Document, Schema } from 'mongoose';

export interface IActivityLog extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  action: string;
  entity?: string;
  entityId?: string;
  entityName?: string;
  details?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    action: { type: String, required: true },
    entity: { type: String },
    entityId: { type: String },
    entityName: { type: String },
    details: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ userId: 1 });
ActivityLogSchema.index({ action: 1 });

export default mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
