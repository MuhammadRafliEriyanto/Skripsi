import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";

const PROGRAMS = [
  {
    name: "SD Kelas 4-6",
    subjects: ["Matematika", "Bahasa Indonesia", "IPA"],
  },
  {
    name: "SMP Kelas 7-9",
    subjects: ["Matematika", "Bahasa Indonesia", "IPA", "Bahasa Inggris"],
  },
  {
    name: "SMA IPA",
    subjects: ["Matematika", "Fisika", "Kimia", "Biologi", "Bahasa Inggris"],
  },
  {
    name: "SMA IPS",
    subjects: ["Matematika", "Ekonomi", "Geografi", "Sosiologi", "Sejarah", "Bahasa Inggris"],
  },
  {
    name: "UTBK / SNBT",
    subjects: ["Penalaran Umum", "Pengetahuan Kuantitatif", "Literasi Bahasa Indonesia", "Literasi Bahasa Inggris"],
  },
];

const TOPICS = Array.from({ length: 24 }, (_, i) => `Bab ${i + 1}: Topik Pembahasan ${i + 1}`);

const QUESTIONS_PER_TOPIC = 150; // 24 topics * 150 questions = 3600 questions per subject per program
const OPTIONS = ["A", "B", "C", "D"];

async function main() {
  console.log("Memulai proses generate bank soal...");
  const data: any[] = [];
  
  for (const program of PROGRAMS) {
    for (const subject of program.subjects) {
      for (const topic of TOPICS) {
        for (let i = 1; i <= QUESTIONS_PER_TOPIC; i++) {
          const correctAns = OPTIONS[Math.floor(Math.random() * OPTIONS.length)];
          const difficulty = i <= 15 ? "Mudah" : i <= 35 ? "Sedang" : "Sulit";
          
          data.push({
            "Program/Kelas": program.name,
            "Mata Pelajaran": subject,
            "Topik/Materi": topic,
            "Soal": `Soal ${topic} nomor ${i} untuk ${subject} tingkat ${program.name}. Bagaimana cara menyelesaikan permasalahan berikut berdasarkan konsep standar kompetensi lulusan?`,
            "Opsi A": `Jawaban A untuk soal nomor ${i}`,
            "Opsi B": `Jawaban B untuk soal nomor ${i}`,
            "Opsi C": `Jawaban C untuk soal nomor ${i}`,
            "Opsi D": `Jawaban D untuk soal nomor ${i}`,
            "Kunci Jawaban": correctAns,
            "Pembahasan": `Pembahasan detail untuk soal nomor ${i}: Karena menurut teori dasar ${subject}, jawaban yang paling tepat adalah ${correctAns}.`,
            "Tingkat Kesulitan": difficulty
          });
        }
      }
    }
  }

  console.log(`Berhasil membuat ${data.length} soal dummy.`);
  console.log("Menulis ke file Excel...");

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(data);
  
  // Set column widths
  ws["!cols"] = [
    { wch: 15 }, // Program
    { wch: 20 }, // Mata Pelajaran
    { wch: 25 }, // Topik
    { wch: 80 }, // Soal
    { wch: 30 }, // A
    { wch: 30 }, // B
    { wch: 30 }, // C
    { wch: 30 }, // D
    { wch: 15 }, // Kunci
    { wch: 60 }, // Pembahasan
    { wch: 15 }, // Kesulitan
  ];

  xlsx.utils.book_append_sheet(wb, ws, "Master Bank Soal");

  const outputDir = path.resolve(__dirname, "../../../outputs/assessment-bank-rekap");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-V3.xlsx");
  xlsx.writeFile(wb, outputPath);
  
  console.log(`File Excel berhasil disimpan di: ${outputPath}`);
}

main().catch(console.error);
