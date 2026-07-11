import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const CLASS_MATERIAL_STATUSES = [
  "Draft",
  "Dipublikasikan",
] as const;

export type ClassMaterialStatus = (typeof CLASS_MATERIAL_STATUSES)[number];

export interface IClassMaterialAttachment {
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
}

export interface IClassMaterial {
  materialId: string;
  classId: string;
  teacherId: Types.ObjectId;
  className: string;
  canonicalClassName: string;
  subject: string;
  branch: string;
  room: string;
  meetingNumber: number;
  date: string;
  title: string;
  description: string;
  linkUrl: string;
  attachment: IClassMaterialAttachment | null;
  status: ClassMaterialStatus;
  academicYear?: string | null;
  semester?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ClassMaterialDocument = HydratedDocument<IClassMaterial>;

const classMaterialSchema = new Schema<IClassMaterial>(
  {
    materialId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    classId: {
      type: String,
      required: [true, "Class ID wajib diisi."],
      trim: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: [true, "Guru wajib diisi."],
      index: true,
    },
    className: {
      type: String,
      required: [true, "Nama kelas wajib diisi."],
      trim: true,
    },
    canonicalClassName: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, "Mata pelajaran wajib diisi."],
      trim: true,
    },
    branch: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    room: {
      type: String,
      default: "",
      trim: true,
    },
    meetingNumber: {
      type: Number,
      required: [true, "Pertemuan wajib diisi."],
      min: 1,
      index: true,
    },
    date: {
      type: String,
      required: [true, "Tanggal materi wajib diisi."],
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Judul materi wajib diisi."],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Deskripsi materi wajib diisi."],
      trim: true,
    },
    linkUrl: {
      type: String,
      default: "",
      trim: true,
    },
    attachment: {
      type: {
        fileName: {
          type: String,
          required: true,
          trim: true,
        },
        mimeType: {
          type: String,
          required: true,
          trim: true,
        },
        size: {
          type: Number,
          required: true,
          min: 0,
        },
        storagePath: {
          type: String,
          required: true,
          trim: true,
        },
      },
      default: null,
    },
    status: {
      type: String,
      enum: CLASS_MATERIAL_STATUSES,
      default: "Draft",
      index: true,
    },
    academicYear: {
      type: String,
      default: null,
      trim: true,
    },
    semester: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

classMaterialSchema.index({
  teacherId: 1,
  classId: 1,
  meetingNumber: 1,
  date: 1,
});

export const ClassMaterial: Model<IClassMaterial> =
  (models.ClassMaterial as Model<IClassMaterial> | undefined) ??
  model<IClassMaterial>("ClassMaterial", classMaterialSchema);
