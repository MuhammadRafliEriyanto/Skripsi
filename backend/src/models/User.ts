import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export const USER_ROLES = ["owner", "admin", "guru", "siswa"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface IUser {
  nama: string;
  email: string;
  loginCode?: string | null;
  avatar: string | null;
  password: string;
  role: UserRole;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  failedLoginAttempts: number;
  lockedAt: Date | null;
  lockedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

export interface PublicUser {
  _id: string;
  nama: string;
  email: string;
  loginCode: string | null;
  avatar: string | null;
  role: UserRole;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    nama: {
      type: String,
      required: [true, "Nama wajib diisi."],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email wajib diisi."],
      unique: true,
      lowercase: true,
      trim: true,
    },
    loginCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    avatar: {
      type: String,
      default: null,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password wajib diisi."],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "siswa",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lockedReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index(
  { loginCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      loginCode: { $type: "string" },
    },
  },
);

export const User: Model<IUser> =
  (models.User as Model<IUser> | undefined) ?? model<IUser>("User", userSchema);
