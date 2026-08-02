import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const LEGACY_EXPENSE_CATEGORIES = [
  "Gaji Guru",
  "Gaji Admin",
  "Operasional Cabang",
  "Internet",
  "Sewa Gedung",
  "Perawatan Fasilitas",
  "Perlengkapan Kelas",
  "Kebersihan",
  "Keamanan",
  "Teknologi",
  "Transportasi Operasional",
  "Lainnya",
] as const;

export const OPERATIONAL_EXPENSE_CATEGORIES = [
  "Wifi",
  "Gedung",
  "Listrik",
] as const;

export const EXPENSE_CATEGORIES = [
  ...LEGACY_EXPENSE_CATEGORIES,
  ...OPERATIONAL_EXPENSE_CATEGORIES,
] as const;

export const EXPENSE_STATUSES = [
  "Menunggu",
  "Dijadwalkan",
  "Selesai",
  "Dibatalkan",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export interface IExpense {
  expenseId: string;
  title: string;
  branch: string;
  category: ExpenseCategory;
  vendorOrRecipient: string;
  amount: number;
  paymentMethod: string;
  status: ExpenseStatus;
  paidAt: Date | null;
  dueDate: Date | null;
  note: string;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  archivedAt: Date | null;
  archivedBy: Types.ObjectId | null;
  archiveReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ExpenseDocument = HydratedDocument<IExpense>;

const expenseSchema = new Schema<IExpense>(
  {
    expenseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Judul pengeluaran wajib diisi."],
      trim: true,
    },
    branch: {
      type: String,
      default: "Pusat",
      trim: true,
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: [true, "Kategori pengeluaran wajib diisi."],
    },
    vendorOrRecipient: {
      type: String,
      required: [true, "Vendor atau penerima wajib diisi."],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Nominal pengeluaran wajib diisi."],
      min: 0,
    },
    paymentMethod: {
      type: String,
      required: [true, "Metode pembayaran wajib diisi."],
      trim: true,
    },
    status: {
      type: String,
      enum: EXPENSE_STATUSES,
      required: [true, "Status pengeluaran wajib diisi."],
      default: "Menunggu",
    },
    paidAt: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    archivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    archiveReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 300,
    },
  },
  {
    timestamps: true,
  },
);


expenseSchema.index({ status: 1, createdAt: -1 });
expenseSchema.index({ branch: 1, status: 1, createdAt: -1 });
expenseSchema.index({ archivedAt: 1, branch: 1, status: 1, createdAt: -1 });

export const Expense: Model<IExpense> =
  (models.Expense as Model<IExpense> | undefined) ?? model<IExpense>("Expense", expenseSchema);
