import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const SUBSCRIPTION_STATUSES = ["pending", "active", "expired"] as const;
export const SUBSCRIPTION_PAYMENT_STATUSES = ["pending", "paid", "failed", "expired", "draft_renewal"] as const;
export const SUBSCRIPTION_SOURCES = ["register_online", "admin"] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type SubscriptionPaymentStatus = (typeof SUBSCRIPTION_PAYMENT_STATUSES)[number];
export type SubscriptionSource = (typeof SUBSCRIPTION_SOURCES)[number];

export interface ISubscription {
  subscriptionCode: string;
  userId: Types.ObjectId;
  studentId: Types.ObjectId;
  packageKey: string;
  packageName: string;
  durationMonth: number;
  startDate: Date | null;
  endDate: Date | null;
  status: SubscriptionStatus;
  paymentStatus: SubscriptionPaymentStatus;
  source: SubscriptionSource;
  createdByAdminId: Types.ObjectId | null;
  renewalOfSubscriptionId: Types.ObjectId | null;
  targetProgram: string | null;
  targetClassName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionDocument = HydratedDocument<ISubscription>;

const subscriptionSchema = new Schema<ISubscription>(
  {
    subscriptionCode: {
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
    packageKey: {
      type: String,
      required: true,
      trim: true,
    },
    packageName: {
      type: String,
      required: true,
      trim: true,
    },
    durationMonth: {
      type: Number,
      required: true,
      min: 1,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: SUBSCRIPTION_PAYMENT_STATUSES,
      default: "pending",
    },
    source: {
      type: String,
      enum: SUBSCRIPTION_SOURCES,
      default: "register_online",
      index: true,
    },
    createdByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    renewalOfSubscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
      index: true,
    },
    targetProgram: {
      type: String,
      default: null,
      trim: true,
    },
    targetClassName: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

subscriptionSchema.index({ studentId: 1, createdAt: -1 });
subscriptionSchema.index({ studentId: 1, status: 1, paymentStatus: 1, createdAt: -1 });

export const Subscription: Model<ISubscription> =
  (models.Subscription as Model<ISubscription> | undefined) ??
  model<ISubscription>("Subscription", subscriptionSchema);
