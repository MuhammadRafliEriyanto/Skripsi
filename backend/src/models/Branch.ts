import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const BRANCH_STATUSES = ["Aktif", "Nonaktif"] as const;

export type BranchStatus = (typeof BRANCH_STATUSES)[number];

export interface IBranch {
  branchId: string;
  name: string;
  shortAddress: string;
  fullAddress: string;
  phone: string;
  email: string;
  status: BranchStatus;
  adminName: string;
  adminUserId: Types.ObjectId | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type BranchDocument = HydratedDocument<IBranch>;

const branchSchema = new Schema<IBranch>(
  {
    branchId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Nama cabang wajib diisi."],
      trim: true,
    },
    shortAddress: {
      type: String,
      default: "",
      trim: true,
    },
    fullAddress: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: BRANCH_STATUSES,
      default: "Aktif",
    },
    adminName: {
      type: String,
      default: "",
      trim: true,
    },
    adminUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

branchSchema.index({ name: 1 });
branchSchema.index({ adminUserId: 1, status: 1 });

export const Branch: Model<IBranch> =
  (models.Branch as Model<IBranch> | undefined) ?? model<IBranch>("Branch", branchSchema);
