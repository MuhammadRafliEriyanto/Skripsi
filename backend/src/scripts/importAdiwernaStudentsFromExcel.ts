import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import XLSX from "xlsx";

import "../config/env";
import { Branch } from "../models/Branch";
import { Student } from "../models/Student";
import { User, type UserDocument } from "../models/User";
import { getNextPublicId } from "../utils/publicId";
import {
  buildImportedStudentDuplicateKey,
  buildImportedStudentEmail,
  normalizeImportedStudentClassName,
  normalizeImportedStudentProgram,
} from "../utils/studentImport";
import { buildGeneratedPasswordForStudent } from "../utils/studentPassword";

type ReadyStudentRow = {
  name: string;
  className: string;
  program: string;
  branch: string;
  source: string;
  note: string;
  sourceRowNumber?: number;
};

type ReviewStudentRow = {
  rowNumber: number;
  name: string;
  classRaw: string;
  program: string;
  branch: string;
  reason: string;
};

type CreatedAccountRow = ReadyStudentRow & {
  studentId: string;
  email: string;
  password: string;
};

type SkippedRow = ReadyStudentRow & {
  reason: string;
};

type PopulatedStudent = {
  studentId: string;
  branch: string;
  program: string;
  className: string;
  userId: Pick<UserDocument, "nama" | "email"> | null;
};

const targetBranch = "Adiwerna";
const sourceFileName = "Data siswa Cabang Adw.xlsx";
const outputFileName = "Data siswa Cabang Adw - siap import.xlsx";

const classOrder = [
  "SD 4",
  "SD 5",
  "SD 6",
  "SMP 7",
  "SMP 8",
  "SMP 9",
  "SMA 10",
  "SMA 11",
  "SMA 12",
] as const;

const targetClassCounts: Record<(typeof classOrder)[number], number> = {
  "SD 4": 10,
  "SD 5": 12,
  "SD 6": 12,
  "SMP 7": 14,
  "SMP 8": 16,
  "SMP 9": 14,
  "SMA 10": 12,
  "SMA 11": 10,
  "SMA 12": 10,
};

const elementarySchools = [
  "SDN Tembok Banjaran 01",
  "SDN Tembok Banjaran 02",
  "SDN Tembok Banjaran 03",
  "SDN Pegirikan 01",
  "SDN Pegirikan 02",
  "SDN Kendalserut 01",
  "SDN Kendalserut 02",
  "SDN Kendalserut 03",
  "SD M Bedug",
  "MI Miftahul Ulum Adiwerna",
  "SDN Lemahduwur 01",
  "SDN Ujungrusi 01",
];

const juniorHighSchools = [
  "SMP N 1 Adiwerna",
  "SMP N 2 Adiwerna",
  "SMP N 3 Adiwerna",
  "SMP N 4 Adiwerna",
  "SMP Muhammadiyah Adiwerna",
  "MTs N 2 Tegal",
];

const seniorHighSchools = [
  "SMA N 1 Adiwerna",
  "SMA PGRI Adiwerna",
  "SMK N 1 Adiwerna",
  "SMK Muhammadiyah Adiwerna",
  "MAN 1 Tegal",
  "MA Al Hikmah Adiwerna",
];

const firstNames = [
  "Alya",
  "Nadira",
  "Rizky",
  "Fathan",
  "Zahra",
  "Naufal",
  "Rafa",
  "Azzam",
  "Hafiz",
  "Nayla",
  "Dimas",
  "Salsabila",
  "Alif",
  "Aurelia",
  "Farhan",
  "Keyla",
  "Rania",
  "Bagas",
  "Aditya",
  "Putri",
  "Ilham",
  "Syifa",
  "Fikri",
  "Anindya",
  "Gilang",
  "Cantika",
  "Rafi",
  "Dewi",
  "Bintang",
  "Khalisa",
  "Mikail",
  "Aisyah",
  "Dzaky",
  "Salma",
  "Yoga",
  "Tiara",
  "Hanif",
  "Laras",
  "Raihan",
  "Azka",
];

const middleNames = [
  "Nur",
  "Ayu",
  "Pratama",
  "Ramadhan",
  "Fauzan",
  "Dwi",
  "Cahya",
  "Putra",
  "Putri",
  "Maulana",
  "Ardiansyah",
  "Permata",
  "Anugrah",
  "Rahma",
  "Kusuma",
  "Saputra",
  "Saputri",
  "Wicaksana",
  "Aulia",
  "Febri",
];

const lastNames = [
  "Prasetya",
  "Hidayat",
  "Lestari",
  "Ramadhani",
  "Setiawan",
  "Anggraeni",
  "Kurniawan",
  "Maharani",
  "Firmansyah",
  "Puspitasari",
  "Wulandari",
  "Nugroho",
  "Safitri",
  "Wijaya",
  "Rahayu",
  "Fadilah",
  "Azzahra",
  "Saputra",
  "Ningrum",
  "Maulida",
];

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function resolveWorkspacePath(fileName: string) {
  return path.resolve(process.cwd(), "..", fileName);
}

function readSourceWorkbook(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File sumber tidak ditemukan: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath, { raw: false });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName || !workbook.Sheets[sheetName]) {
    throw new Error("Sheet pertama pada file sumber tidak dapat dibaca.");
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }) as unknown[][];
  const readyRows: ReadyStudentRow[] = [];
  const reviewRows: ReviewStudentRow[] = [];
  const seenKeys = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const name = normalizeText(row[0]);
    const classRaw = normalizeText(row[1]);
    const program = normalizeImportedStudentProgram(normalizeText(row[2]));

    if (!name && !classRaw && !program) {
      return;
    }

    const className = normalizeImportedStudentClassName(classRaw);

    if (!name || !program || !className) {
      reviewRows.push({
        rowNumber,
        name,
        classRaw,
        program,
        branch: targetBranch,
        reason: !className
          ? "Kelas belum didukung sistem. Sistem menerima SD 4-6, SMP 7-9, SMA 10-12."
          : "Nama atau asal sekolah kosong.",
      });
      return;
    }

    const duplicateKey = buildImportedStudentDuplicateKey({
      name,
      className,
      program,
    });

    if (seenKeys.has(duplicateKey)) {
      reviewRows.push({
        rowNumber,
        name,
        classRaw,
        program,
        branch: targetBranch,
        reason: "Duplikat di file sumber.",
      });
      return;
    }

    seenKeys.add(duplicateKey);
    readyRows.push({
      name,
      className,
      program,
      branch: targetBranch,
      source: "Excel awal",
      note: "Data dari file sumber",
      sourceRowNumber: rowNumber,
    });
  });

  return {
    readyRows,
    reviewRows,
  };
}

function getSchoolPool(className: string) {
  if (className.startsWith("SD ")) {
    return elementarySchools;
  }

  if (className.startsWith("SMP ")) {
    return juniorHighSchools;
  }

  return seniorHighSchools;
}

function buildGeneratedName(index: number, usedNames: Set<string>) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const seed = index + attempt;
    const firstName = firstNames[seed % firstNames.length];
    const middleName =
      middleNames[Math.floor(seed / firstNames.length) % middleNames.length];
    const lastName =
      lastNames[
        Math.floor(seed / (firstNames.length * middleNames.length)) %
          lastNames.length
      ];
    const name =
      seed % 4 === 0
        ? `${firstName} ${middleName} ${lastName}`
        : `${firstName} ${lastName}`;
    const normalizedName = name.toLowerCase();

    if (!usedNames.has(normalizedName)) {
      usedNames.add(normalizedName);
      return name;
    }
  }

  throw new Error("Gagal membuat nama siswa tambahan yang unik.");
}

function buildGeneratedRows(sourceRows: ReadyStudentRow[]) {
  const classCounts = new Map<string, number>();
  const usedNames = new Set(sourceRows.map((row) => row.name.toLowerCase()));
  const generatedRows: ReadyStudentRow[] = [];
  let generatedIndex = 0;

  sourceRows.forEach((row) => {
    classCounts.set(row.className, (classCounts.get(row.className) ?? 0) + 1);
  });

  classOrder.forEach((className) => {
    const targetCount = targetClassCounts[className];
    const currentCount = classCounts.get(className) ?? 0;
    const schoolPool = getSchoolPool(className);

    for (let count = currentCount; count < targetCount; count += 1) {
      const name = buildGeneratedName(generatedIndex, usedNames);
      const school = schoolPool[(generatedIndex + count) % schoolPool.length];

      generatedRows.push({
        name,
        className,
        program: school,
        branch: targetBranch,
        source: "Tambahan",
        note: "Data tambahan seed Adiwerna",
      });
      generatedIndex += 1;
    }
  });

  return generatedRows;
}

function summarizeByClass(rows: ReadyStudentRow[]) {
  return classOrder.map((className) => ({
    className,
    count: rows.filter((row) => row.className === className).length,
    target: targetClassCounts[className],
  }));
}

function buildWorksheet<T extends Record<string, unknown>>(
  headers: string[],
  rows: T[],
  mapRow: (row: T, index: number) => unknown[],
) {
  return XLSX.utils.aoa_to_sheet([headers, ...rows.map(mapRow)]);
}

function applyColumnWidths(worksheet: XLSX.WorkSheet, widths: number[]) {
  worksheet["!cols"] = widths.map((width) => ({ wch: width }));
}

function writeOutputWorkbook(params: {
  outputPath: string;
  readyRows: ReadyStudentRow[];
  reviewRows: ReviewStudentRow[];
  createdAccounts: CreatedAccountRow[];
  skippedRows: SkippedRow[];
  apply: boolean;
}) {
  const workbook = XLSX.utils.book_new();
  const readySheet = buildWorksheet(
    ["No", "Nama", "Kelas", "Asal Sekolah", "Cabang", "Sumber", "Catatan"],
    params.readyRows,
    (row, index) => [
      index + 1,
      row.name,
      row.className,
      row.program,
      row.branch,
      row.source,
      row.note,
    ],
  );
  applyColumnWidths(readySheet, [6, 32, 12, 30, 14, 14, 28]);
  XLSX.utils.book_append_sheet(workbook, readySheet, "Siap Import");

  const reviewSheet = buildWorksheet(
    ["No", "Row Excel", "Nama", "Kelas Asli", "Asal Sekolah", "Cabang", "Alasan"],
    params.reviewRows,
    (row, index) => [
      index + 1,
      row.rowNumber,
      row.name,
      row.classRaw,
      row.program,
      row.branch,
      row.reason,
    ],
  );
  applyColumnWidths(reviewSheet, [6, 10, 32, 12, 30, 14, 58]);
  XLSX.utils.book_append_sheet(workbook, reviewSheet, "Perlu Dicek");

  const summaryRows = [
    ["Cabang", targetBranch],
    ["Total siap import", params.readyRows.length],
    ["Dari Excel awal", params.readyRows.filter((row) => row.source === "Excel awal").length],
    ["Tambahan", params.readyRows.filter((row) => row.source === "Tambahan").length],
    ["Perlu dicek", params.reviewRows.length],
    ["Mode database", params.apply ? "Apply" : "Dry-run"],
    ["Akun dibuat", params.createdAccounts.length],
    ["Dilewati karena sudah ada", params.skippedRows.length],
    [],
    ["Kelas", "Jumlah", "Target"],
    ...summarizeByClass(params.readyRows).map((row) => [
      row.className,
      row.count,
      row.target,
    ]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  applyColumnWidths(summarySheet, [24, 20, 14]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");

  if (params.apply) {
    const accountSheet = buildWorksheet(
      [
        "No",
        "Student ID",
        "Nama",
        "Email",
        "Password",
        "Kelas",
        "Asal Sekolah",
        "Cabang",
      ],
      params.createdAccounts,
      (row, index) => [
        index + 1,
        row.studentId,
        row.name,
        row.email,
        row.password,
        row.className,
        row.program,
        row.branch,
      ],
    );
    applyColumnWidths(accountSheet, [6, 14, 32, 28, 16, 12, 30, 14]);
    XLSX.utils.book_append_sheet(workbook, accountSheet, "Akun Dibuat");

    const skippedSheet = buildWorksheet(
      ["No", "Nama", "Kelas", "Asal Sekolah", "Cabang", "Alasan"],
      params.skippedRows,
      (row, index) => [
        index + 1,
        row.name,
        row.className,
        row.program,
        row.branch,
        row.reason,
      ],
    );
    applyColumnWidths(skippedSheet, [6, 32, 12, 30, 14, 42]);
    XLSX.utils.book_append_sheet(workbook, skippedSheet, "Dilewati");
  }

  XLSX.writeFile(workbook, params.outputPath);
}

async function getExistingStudentKeys() {
  const students = (await Student.find()
    .populate<{ userId: PopulatedStudent["userId"] }>({
      path: "userId",
      model: User,
      select: "nama email",
    })
    .select("studentId branch program className userId")
    .exec()) as unknown as PopulatedStudent[];

  return new Set(
    students
      .filter((student) => student.userId)
      .map((student) =>
        buildImportedStudentDuplicateKey({
          name: normalizeText(student.userId?.nama),
          className: normalizeText(student.className),
          program: normalizeText(student.program),
        }),
      ),
  );
}

async function getNextAvailableStudentIdentity() {
  let nextNumber = Number(
    (await getNextPublicId(Student, "studentId", "STD")).replace(/\D/g, ""),
  );

  for (let attempt = 0; attempt < 3000; attempt += 1) {
    const studentId = `STD-${String(nextNumber).padStart(3, "0")}`;
    const email = buildImportedStudentEmail(studentId);
    const existingStudent = await Student.exists({ studentId }).exec();

    if (existingStudent) {
      nextNumber += 1;
      continue;
    }

    const existingUser = await User.findOne({ email }).exec();

    if (!existingUser) {
      return {
        studentId,
        email,
      };
    }

    nextNumber += 1;
  }

  throw new Error("Gagal mencari Student ID yang tersedia.");
}

async function createStudentAccount(row: ReadyStudentRow) {
  const { studentId, email } = await getNextAvailableStudentIdentity();
  const password = buildGeneratedPasswordForStudent({ studentId });
  const hashedPassword = await bcrypt.hash(password, 12);
  let createdUser: UserDocument | null = null;

  try {
    createdUser = await User.create({
      nama: row.name,
      email,
      password: hashedPassword,
      role: "siswa",
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    await Student.create({
      studentId,
      userId: createdUser._id,
      phone: "",
      branch: row.branch,
      program: row.program,
      className: row.className,
      birthDate: null,
      status: "Aktif",
    });

    return {
      ...row,
      studentId,
      email,
      password,
    } satisfies CreatedAccountRow;
  } catch (error) {
    if (createdUser) {
      await User.deleteOne({ _id: createdUser._id });
    }

    throw error;
  }
}

async function importRows(rows: ReadyStudentRow[]) {
  const branch = await Branch.findOne({ name: targetBranch }).select("name").lean().exec();

  if (!branch) {
    throw new Error(`Cabang ${targetBranch} belum ada di database.`);
  }

  const existingKeys = await getExistingStudentKeys();
  const createdKeys = new Set<string>();
  const createdAccounts: CreatedAccountRow[] = [];
  const skippedRows: SkippedRow[] = [];

  for (const row of rows) {
    const duplicateKey = buildImportedStudentDuplicateKey({
      name: row.name,
      className: row.className,
      program: row.program,
    });

    if (existingKeys.has(duplicateKey) || createdKeys.has(duplicateKey)) {
      skippedRows.push({
        ...row,
        reason: "Sudah ada di database atau duplikat dalam batch.",
      });
      continue;
    }

    try {
      const createdAccount = await createStudentAccount({
        ...row,
        branch: branch.name,
      });
      createdAccounts.push(createdAccount);
      existingKeys.add(duplicateKey);
      createdKeys.add(duplicateKey);
    } catch (error) {
      skippedRows.push({
        ...row,
        reason: error instanceof Error ? error.message : "Gagal membuat akun siswa.",
      });
    }
  }

  return {
    createdAccounts,
    skippedRows,
  };
}

async function run() {
  const apply = hasFlag("--apply");
  const sourcePath = resolveWorkspacePath(sourceFileName);
  const outputPath = resolveWorkspacePath(outputFileName);
  const source = readSourceWorkbook(sourcePath);
  const generatedRows = buildGeneratedRows(source.readyRows);
  const readyRows = [...source.readyRows, ...generatedRows];
  let createdAccounts: CreatedAccountRow[] = [];
  let skippedRows: SkippedRow[] = [];

  if (apply) {
    await mongoose.connect(process.env.MONGO_URI as string);
    const result = await importRows(readyRows);
    createdAccounts = result.createdAccounts;
    skippedRows = result.skippedRows;
    await mongoose.disconnect();
  }

  writeOutputWorkbook({
    outputPath,
    readyRows,
    reviewRows: source.reviewRows,
    createdAccounts,
    skippedRows,
    apply,
  });

  console.log(
    JSON.stringify(
      {
        action: apply ? "apply" : "dry-run",
        sourcePath,
        outputPath,
        readyRows: readyRows.length,
        sourceRows: source.readyRows.length,
        generatedRows: generatedRows.length,
        reviewRows: source.reviewRows.length,
        createdAccounts: createdAccounts.length,
        skippedRows: skippedRows.length,
        classSummary: summarizeByClass(readyRows),
      },
      null,
      2,
    ),
  );
}

void run().catch(async (error) => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  console.error(error);
  process.exit(1);
});
