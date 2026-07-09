import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "expired", "draft_renewal"] as const;
export const PAYMENT_SOURCES = ["register_online", "admin"] as const;
export const PAYMENT_CANCEL_REASONS = [
  "admin_cancelled",
  "replaced_by_new_session",
  "provider_canceled",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];
export type PaymentCancelReason = (typeof PAYMENT_CANCEL_REASONS)[number];

export interface IPayment {
  paymentId: string;
  userId: Types.ObjectId;
  studentId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  packageKey: string | null;
  packageName: string;
  durationMonth: number | null;
  amount: number;
  provider: string;
  method: string;
  status: PaymentStatus;
  source: PaymentSource;
  createdByAdminId: Types.ObjectId | null;
  paidAt: Date | null;
  checkoutUrl: string | null;
  expiresAt: Date | null;
  checkoutLastSentAt: Date | null;
  checkoutSendCount: number;
  cancelReason: PaymentCancelReason | null;
  canceledAt: Date | null;
  archivedAt: Date | null;
  archivedByAdminId: Types.ObjectId | null;
  archiveReason: string | null;
  xenditReferenceId: string | null;
  xenditPaymentSessionId: string | null;
  xenditPaymentRequestId: string | null;
  xenditPaymentId: string | null;
  xenditCustomerId: string | null;
  xenditSessionStatus: string | null;
  xenditWebhookReceivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentDocument = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
      index: true,
    },
    packageKey: {
      type: String,
      default: null,
      trim: true,
    },
    packageName: {
      type: String,
      required: true,
      trim: true,
    },
    durationMonth: {
      type: Number,
      default: null,
      min: 1,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    provider: {
      type: String,
      required: true,
      default: "manual",
      trim: true,
    },
    method: {
      type: String,
      required: true,
      default: "manual_transfer",
      trim: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
    },
    source: {
      type: String,
      enum: PAYMENT_SOURCES,
      default: "register_online",
      index: true,
    },
    createdByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    checkoutUrl: {
      type: String,
      default: null,
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    checkoutLastSentAt: {
      type: Date,
      default: null,
    },
    checkoutSendCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cancelReason: {
      type: String,
      enum: PAYMENT_CANCEL_REASONS,
      default: null,
      trim: true,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    archivedByAdminId: {
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
    xenditReferenceId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    xenditPaymentSessionId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    xenditPaymentRequestId: {
      type: String,
      default: null,
      trim: true,
    },
    xenditPaymentId: {
      type: String,
      default: null,
      trim: true,
    },
    xenditCustomerId: {
      type: String,
      default: null,
      trim: true,
    },
    xenditSessionStatus: {
      type: String,
      default: null,
      trim: true,
    },
    xenditWebhookReceivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({ subscriptionId: 1, createdAt: -1 });
paymentSchema.index({ studentId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ source: 1, status: 1, createdAt: -1 });
paymentSchema.index({ archivedAt: 1, source: 1, status: 1, createdAt: -1 });

export const Payment: Model<IPayment> =
  (models.Payment as Model<IPayment> | undefined) ?? model<IPayment>("Payment", paymentSchema);
