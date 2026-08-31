/**
 * CONTEXT & OPENING VARIATION ENGINE v2.0
 * 
 * Provides subject-specific context pools and opening phrases to prevent
 * repetitive "Dalam/Sebuah/Suatu" patterns.
 * 
 * FEATURES:
 * 1. Pre-defined context pools per subject/topic
 * 2. Context rotation based on variant and index
 * 3. Multiple opening phrase variations (20+ per subject)
 * 4. Prevents predictable repetition within a batch
 * 5. Subject-appropriate contexts only
 * 
 * USAGE:
 * import { VariationEngine } from './variation-engine.mjs'
 * const engine = new VariationEngine()
 * const context = engine.getContext('Matematika', 'Eksponen', 0, 5)
 */

class VariationEngine {
  constructor() {
    this.contextPools = this._initializeContextPools();
    this.openingPatterns = this._initializeOpeningPatterns();
  }

  _initializeContextPools() {
    return {
      Matematika: {
        Eksponen: {
          scenarios: [
            "Pertumbuhan bakteri dalam laboratorium",
            "Perkembangbiakan virus di sel inang",
            "Akumulasi bunga majemuk bank",
            "Penyebaran informasi di media sosial",
            "Reaksi berantai pada nuklir fisi",
            "Populasi hewan dalam ekosistem",
            "Cahaya lampu yang meredup tiap jam",
            "Peluruhan zat radioaktif",
            "Pengembangan populasi mikroorganisme",
            "Kompresi file digital berulang kali"
          ],
          objects: ["sel", "bit data", "virus", "poin viral", "atom", "partikel"]
        },
        Logaritma: {
          scenarios: [
            "Skala Richter gempa bumi",
            "Kekuatan suara desibel",
            "Tingkat keasaman pH larutan",
            "Kedalaman tsunami energi",
            "Magnitudo bintang astronomi",
            "Tingkat kejenuhan air tanah",
            "Koncentrasi kimia larutan",
            "Daya akuisisi sensor elektronik",
            "Rasio kompresi audio",
            "Indeks polusi udara AQI"
          ]
        },
        PersamaanKuadrat: {
          scenarios: [
            "Jatuh bebas bola dari gedung tinggi",
            "Lintasan peluru senapan",
            "Bentuk parabola jembatan gantung",
            "Perubahan suhu harian optimal",
            "Titik tertinggi roket mainan",
            "Jarak maksimal lemparan atlet",
            "Desain lensa cembung optik",
            "Lintasan air dari seluncuran",
            "Area maksimum kandang ternak",
            "Keuntungan maksimum bisnis"
          ]
        },
        Trigonometri: {
          scenarios: [
            "Jarak kapal laut dari pantai",
            "Tinggi gedung dengan sudut elevasi",
            "Posisi matahari terhadap bayangan",
            "Sudut kemiringan tangga aman",
            "Ketinggian pesawat terbang",
            "Panjang tali tambang menara",
            "Lokasi GPS satelit orbit",
            "Jarak bulan dari Bumi",
            "Posisi jarum jam analog",
            "Refleksi cahaya cermin datar"
          ]
        },
        Limit: {
          scenarios: [
            "Kecepatan sesaat mobil sport",
            "Laju pertumbuhan populasi limit",
            "Pendekatan nilai pi secara iteratif",
            "Dekomposisi obat dalam darah",
            "Momentum benda mendekati cahaya",
            "Persentase pengurangan limbah",
            "Efisiensi panel surya optimal",
            "Kapasitas penyimpanan disket",
            "Frekuensi sinyal approaching zero",
            "Resistensi sirkuit ideal"
          ]
        },
        Turunan: {
          scenarios: [
            "Laju perubahan suhu ruangan",
            "Vektor kecepatan partikel bergerak",
            "Optimisasi luas area taman kota",
            "Laju inflasi ekonomi bulanan",
            "Kenaikan permukaan air danau",
            "Tingkat penularan penyakit epidemi",
            "Perubahan resistensi bahan listrik",
            "Pertumbuhan tanaman organik cepat",
            "Reduksi emisi karbon tahunan",
            "Efisiensi mesin kalor Carnot"
          ]
        },
        Integral: {
          scenarios: [
            "Volume air kolam renang berbentuk lengkung",
            "Luas daerah kurva permintaan pasar",
            "Massa benda tak beraturan fisika",
            "Total konsumsi energi listrik harian",
            "Jarak tempuh kendaraan dari grafik",
            "Volume tumpahan cairan spill",
            "Luas lahan pertanian terkeliling",
            "Energi kinetik benda rotasi",
            "Work total gaya variabel",
            "Luas daerah curah hujan wilayah"
          ]
        }
      },
      
      Fisika: {
        GerakLurus: {
          scenarios: [
            "Mobil balap F1 masuk pit stop",
            "Pesawat terbang landing speed",
            "Lari sprinter Olimpiade 100m",
            "Kereta api berhenti diam",
            "Sepeda motor turun bukit curam",
            "Kapal laut docking dermaga",
            "Satelit mengorbit Bumi rendah",
            "Orang berjalan di eskalator naik",
            "Bandara drone delivery landing",
            "Roller coaster loop nol gravitasi"
          ]
        }
      },
      
      Kimia: {
        Stoikiometri: {
          scenarios: [
            "Reaksi pembakaran bahan bakar mobil",
            "Proses fotosintesis alami daun",
            "Elektrolisis air menghasilkan hidrogen",
            "Netralisasi asam basa dapur",
            "Pembentukan ozon stratosfer",
            "Fotosintesis buatan solar cell",
            "Fermentasi gula menjadi alkohol",
            "Oksidasi besi korosi karat",
            "Peleburan bijih logam aluminum",
            "Distilasi minyak mentah petroleum"
          ]
        }
      },
      
      Biologi: {
        Genetika: {
          scenarios: [
            "Hereditas warna mata manusia",
            "Pewarisan golongan darah ABO",
            "Mutasi genetik kromosom X",
            "Silsilah pohon keluarga albinisme",
            "Persilangan Mendel ercis kacang",
            "Dominansi alel sifat dominan resesif",
            "Genetic engineering tanaman GMO",
            "Cloning domba Dolly mammal",
            "Kanker DNA mutation tumor",
            "Hibridisasi persilangan varietas"
          ]
        },
        
        Ekosistem: {
          scenarios: [
            "Rantai makanan savana Afrika",
            "Jaring-jaring makanan hutan Amazon",
            "Siklus karbon atmosfer global",
            "Aliran energi ekologi piramida",
            "Interaksi simbiosis mutualisme",
            "Kompetisi spesies niche overlap",
            "Predasi serigala rusa mangsa",
            "Parasitisme kutu anjing inang",
            "Suksesi ekosistem pasca kebakaran",
            "Restorasi terumbu karang coral reef"
          ]
        }
      }
    };
  }

  _initializeOpeningPatterns() {
    return {
      Matematika: [
        // Direct calculation templates
        "Hitunglah hasil dari operasi berikut:",
        "Berapakah nilai dari persamaan ini?",
        "Manakah jawaban yang tepat untuk soal...",
        "Sederhanakan bentuk matematika ini menjadi:",
        "Tentukan nilai x pada persamaan...",
        
        // Problem-solving with names
        "Andi menghitung ${operation}. Berapa hasilnya?",
        "Maria menemukan ${problem}. Berapa solusinya?",
        "Pak Guru memberikan soal ${task}. Selesaikan!",
        "Seorang insinyur menghitung ${calculation}. Hasilnya?",
        
        // Data-based questions
        "Dari tabel berikut, hitunglah ${metric}:",
        "Berdasarkan data ${dataset}, berapa ${query}?",
        "Grafik menunjukkan ${trend}. Nilai ${variable} adalah?",
        
        // Comparison questions
        "Manakah yang memiliki nilai ${comparison}?",
        "Bandingkan ${object1} dan ${object2}, mana lebih ${attribute}?",
        
        // Pattern recognition
        "Perhatikan pola berikut: ${pattern}. Angka berikutnya adalah?",
        "Susunan angka ${sequence}. Angka selanjutnya?",
        
        // Real-world applications
        "Untuk menghitung ${application}, digunakan rumus ${formula}. Contoh:",
        "Penerapan konsep ${concept} dalam kehidupan sehari-hari:",
        
        // Error analysis
        "Seorang siswa menjawab ${answer}. Apa kesalahannya?",
        "Solusi berikut mengandung kesalahan. Perbaiki:",
        
        // Multi-step problems
        "Langkah pertama hitung ${step1}, lalu lanjutkan ke ${step2}. Hasil akhir?",
        
        // Estimation tasks
        "Taksirlah hasil dari ${estimation}. Paling dekat dengan?"
      ],
      
      Fisika: [
        "Observasi fenomena berikut: ${phenomenon}. Jelaskan prinsip fisika di balik...?",
        "Ketika ${scenario} terjadi, berapa ${result}?",
        "Data eksperimen menunjukkan ${data}. Kesimpulan tentang ${concept}?",
        "Berdasarkan hukum ${law}, jika ${condition}, maka ${outcome}?",
        "Mengamati ${object} bergerak dengan ${motion}. Kecepatan akhir?",
        "Perbedaan antara ${phenomenon1} dan ${phenomenon2} terletak pada...?",
        "Jika ${equipment} menghasilkan ${measurement}, maka ${inference}?",
        "Prinsip ${principle} diterapkan pada ${device}. Bagaimana cara kerjanya?"
      ],
      
      Kimia: [
        "Reaksi kimia berikut: ${equation}. Produk yang terbentuk?",
        "Stoikiometri reaksi ${reaction} membutuhkan ${reagent} sebanyak...",
        "Laboratorium mengukur ${property} zat tersebut. Hasil analisis?",
        "Berdasarkan tabel periodik, unsur ${element} memiliki karakteristik...",
        "Persamaan reaksi ${reaction} tidak setara. Lengkapi koefisien..."
      ],
      
      Biologi: [
        "Proses biologis ${process} terjadi melalui tahapan...",
        "Struktur ${organ} berfungsi untuk ${function}. Mengapa demikian?",
        "Organisme dalam ekosistem ${ecosystem} berinteraksi sebagai...",
        "Genetika pewarisan sifat ${trait} mengikuti pola...",
        "Adaptasi organisme terhadap lingkungan ${environment} berupa..."
      ]
    };
  }

  /**
   * Get a context for a specific topic
   * @param {string} subject - Subject name (e.g., "Matematika")
   * @param {string} topic - Topic name (e.g., "Eksponen")
   * @param {number} index - Question index within batch
   * @param {number} variant - Variant number
   * @returns {{context: string, variables: object}} Context object with fillable variables
   */
  getContext(subject, topic, index, variant) {
    if (!this.contextPools[subject] || !this.contextPools[subject][topic]) {
      // Fallback: generate dynamic scenario based on topic name
      return {
        context: `Dalam konteks ${topic}`,
        variables: {
          subject,
          topic
        }
      };
    }

    const pool = this.contextPools[subject][topic];
    const contextIndex = (index + variant * 2) % pool.scenarios.length;
    const scenario = pool.scenarios[contextIndex];
    
    // Generate fillable variables from the scenario
    const variables = {};
    
    if (pool.objects && pool.objects.length > 0) {
      const objIndex = (index + variant * 3) % pool.objects.length;
      variables.item = pool.objects[objIndex];
    }

    return {
      context: scenario,
      variables,
      scenarioIndex: contextIndex
    };
  }

  /**
   * Get an opening pattern that matches the question structure
   * @param {string} subject - Subject name
   * @param {string} structureType - Type of question structure
   * @param {number} index - Question index
   * @param {number} variant - Variant number
   * @returns {string} Opening template
   */
  getOpeningPattern(subject, structureType, index, variant) {
    const patterns = this.openingPatterns[subject] || [];
    
    if (patterns.length === 0) {
      return 'Hitunglah hasil dari soal berikut:'; // Default fallback
    }
    
    // Select pattern based on structure type and rotation
    let startIndex = 0;
    switch (structureType) {
      case 'DIRECT':     startIndex = 0; break;       // First 5 are direct calculation
      case 'SCENARIO':   startIndex = 3; break;       // Next scenarios
      case 'DATA':       startIndex = 6; break;       // Data-based questions
      case 'COMPARISON': startIndex = 8; break;       // Comparison questions  
      case 'APPLICATION': startIndex = 10; break;    // Real-world applications
      case 'PATTERN':    startIndex = 12; break;      // Pattern recognition
      default:           startIndex = 0; break;
    }

    // Use both index and variant for better distribution
    const totalRotation = startIndex + (index % 20) + (variant * 2);
    const patternIndex = totalRotation % patterns.length;
    return patterns[patternIndex];
  }

  /**
   * Rotate context to ensure diversity within a batch
   * @param {string} subject - Subject name
   * @param {string} topic - Topic name
   * @param {number} variant - Variant number (usually 0-9)
   * @returns {Array} Array of unique contexts for full batch
   */
  getFullBatchContexts(subject, topic, variant) {
    if (!this.contextPools[subject] || !this.contextPools[subject][topic]) {
      return Array(50).fill({ context: `Soal ${subject} topik ${topic}`, variables: {} });
    }

    const pool = this.contextPools[subject][topic];
    const contexts = [];
    
    for (let i = 0; i < 50; i++) {
      const contextIndex = (i + variant * 2) % pool.scenarios.length;
      contexts.push({
        context: pool.scenarios[contextIndex],
        variables: {},
        scenarioIndex: contextIndex
      });
    }

    return contexts;
  }
}

export { VariationEngine };
