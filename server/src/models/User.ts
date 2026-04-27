import crypto from 'crypto';
import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'operator';
  mustChangePassword: boolean;
  loginToken: string;
  tokenVersion: number;
  createdAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    role: { type: String, enum: ['admin', 'operator'], default: 'operator' },
    mustChangePassword: { type: Boolean, default: true },
    loginToken: {
      type: String,
      unique: true,
      select: false,
      default: () => crypto.randomBytes(32).toString('hex'),
    },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Hash password prima del salvataggio
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Non restituire la password nelle query
UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as { password?: string; loginToken?: string }).password;
    delete (ret as { password?: string; loginToken?: string }).loginToken;
    return ret;
  },
});

export default mongoose.model<IUser>('User', UserSchema);
