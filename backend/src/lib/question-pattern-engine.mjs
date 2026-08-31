/**
 * GENERIC QUESTION PATTERN ENGINE v2.0
 * 
 * FITUR UTAMA:
 * 1. Multi-strategy question generation (10+ strategies)
 * 2. Natural language variation per topic
 * 3. No repetitive "Dalam/Sebuah/Suatu" patterns
 * 4. Structural diversity in every 10 questions
 * 5. Context rotation based on subject relevance
 * 
 * STRATEGIES:
 * - DIRECT_QUESTIONS    : Pertanyaan langsung tanpa konteks
 * - SCENARIO_BASED      : Situasi/realm-world context
 * - APPLICATION_FOCUS   : Penerapan konsep dalam kasus
 * - COMPARATIVE         : Perbandingan antar konsep
 * - IDENTIFICATION      : Mengidentifikasi bagian/komponen
 * - CAUSE_EFFECT        : Hubungan sebab-akibat
 * - DATA_INTERPRETATION : Analisis data/tabel/grafik
 * - CONCEPTUAL          : Pertanyaan konsep teoretis
 * - PROCEDURAL          : Langkah-langkah/proses
 * - ANALYTICAL          : Analisis/multistep reasoning
 * 
 * USAGE:
 * import { QuestionEngine } from './question-pattern-engine.js'
 * const engine = new QuestionEngine(subject, difficulty, curriculumData)
 * const questions = engine.generate(topicName, count, variant)
 */

// =====================================================
// STRATEGY DEFINITIONS
// =====================================================

const QuestionStrategies = {
  
  // Strategy 1: Direct Questions - No unnecessary context
  DIRECT_QUESTIONS: {
    id: 'direct',
    priority: 0.30, // Used in 30% of questions
    patterns: [
      {
        template: "Berapa hasil dari {operation}?",
        example: "Berapa hasil dari 125 + 275?"
      },
      {
        template: "Hitung nilai dari {expression}.",
        example: "Hitung nilai dari 8² × 2³."
      },
      {
        template: "Manakah hasil dari {operation}?",
        example: "Manakah hasil dari 3/4 + 1/6?"
      },
      {
        template: "{equation}, maka nilai {variable} adalah...",
        example: "2x + 10 = 30, maka nilai x adalah..."
      },
      {
        template: "Sederhanakan bentuk {expression} menjadi...",
        example: "Sederhanakan bentuk √72 menjadi..."
      }
    ]
  },
  
  // Strategy 2: Scenario-Based - Real world situations
  SCENARIO_BASED: {
    id: 'scenario',
    priority: 0.20,
    patterns: [
      {
        template: "{subject_name} memiliki {item_count} {item}. Ia {action}. Berapa {result}?",
        example: "Rani memiliki 24 buku. Ia membeli 15 buku lagi. Berapa jumlah buku Rani sekarang?"
      },
      {
        template: "Seorang {profession} mencatat {initial_value}. Setelah {event}, berapa {final_query}?",
        example: "Seorang penjaga toko mencatat 25 pensil di rak. Setelah 10 pensil dibeli pelanggan, berapa banyak pensil yang masih tersedia?"
      },
      {
        template: "Stok awal {item} sejumlah {count} buah. Hari itu {sale_count} buah terjual. Hitung sisa stok.",
        example: "Stok pensil awal sebuah toko berjumlah 25 buah. Hari itu 10 buah terjual. Hitung sisa stok pensil."
      },
      {
        template: "Sebanyak {sold_count} dari {total_count} {items} yang tersedia telah terjual. Berapa {items} yang belum terjual?",
        example: "Sebanyak 10 dari 25 pensil yang tersedia telah terjual. Berapa pensil yang belum terjual?"
      }
    ]
  },
  
  // Strategy 3: Application Focus - Practical use cases
  APPLICATION_FOCUS: {
    id: 'application',
    priority: 0.15,
    patterns: [
      {
        template: "Untuk menghitung {concept}, seseorang perlu {method}. Contoh: {example_scenario}",
        example: "Untuk menghitung luas persegi panjang, seseorang perlu mengalikan panjang dan lebar. Contoh: Sebuah halaman berukuran 12m × 8m, berapa m² halamannya?"
      },
      {
        template: "Penerapan rumus {formula} pada kasus {scenario}: {problem_statement}",
        example: "Penerapan rumus luas lingkaran pada kasus taman bulat: Jika diameter taman 14m, berapa m² luas taman tersebut?"
      }
    ]
  },
  
  // Strategy 4: Comparative Analysis
  COMPARATIVE: {
    id: 'comparative',
    priority: 0.10,
    patterns: [
      {
        template: "Perhatikan dua/b {item1} dan {item2}. Manakah yang {comparison_criteria}?",
        example: "Perhatikan dua pecahan berikut: 3/4 dan 5/8. Pecahan manakah yang lebih besar?"
      },
      {
        template: "Mana yang lebih {adjective}: {option_a} atau {option_b}?",
        example: "Mana yang lebih besar: 2/3 atau 3/5?"
      }
    ]
  },
  
  // Strategy 5: Identification Questions
  IDENTIFICATION: {
    id: 'identification',
    priority: 0.08,
    patterns: [
      {
        template: "Manakah bagian/b {component} yang berfungsi {purpose}?",
        example: "Manakah bagian tumbuhan yang berfungsi menyerap air dan mineral dari tanah?"
      },
      {
        template: "Identifikasi fungsi dari {component} dalam sistem {system}.",
        example: "Identifikasi fungsi stomata pada daun tumbuhan."
      }
    ]
  },
  
  // Strategy 6: Cause-Effect Relationships
  CAUSE_EFFECT: {
    id: 'cause_effect',
    priority: 0.07,
    patterns: [
      {
        template: "Apa yang terjadi jika {condition}?",
        example: "Apa yang terjadi jika tanaman tidak mendapatkan cahaya matahari dalam waktu lama?"
      },
      {
        template: "{phenomenon} terjadi karena {cause}. Jelaskan hubungannya!",
        example: "Eutrofikasi terjadi karena pencemaran pupuk ke sungai. Jelaskan hubungannya!"
      }
    ]
  },
  
  // Strategy 7: Data Interpretation
  DATA_INTERPRETATION: {
    id: 'data_interp',
    priority: 0.05,
    patterns: [
      {
        template: "Berdasarkan data berikut: {data_summary}. Pertanyaan terkait adalah...",
        example: "Berdasarkan data nilai siswa: 70, 80, 75, 90, 85. Berapa rata-ratanya?"
      },
      {
        template: "Dari tabel/data di atas, dapat disimpulkan bahwa {inference}. Benarkah? Jelaskan!",
        example: "Dari tabel pertumbuhan penduduk di atas, dapat disimpulkan bahwa laju pertumbuhan menurun. Benarkah? Jelaskan!"
      }
    ]
  },
  
  // Strategy 8: Conceptual Understanding
  CONCEPTUAL: {
    id: 'conceptual',
    priority: 0.05,
    patterns: [
      {
        template: "Mengapa {phenomenon} dapat terjadi?",
        example: "Mengapa langit berwarna biru pada siang hari?"
      },
      {
        template: "Jelaskan perbedaan antara {concept_a} dan {concept_b}.",
        example: "Jelaskan perbedaan antara percepatan dan kecepatan."
      }
    ]
  },
  
  // Strategy 9: Procedural/Process-based
  PROCEDURAL: {
    id: 'procedural',
    priority: 0.04,
    patterns: [
      {
        template: "Bagaimana cara {process_step} dengan menggunakan {formula/method}?",
        example: "Bagaimana cara menentukan luas persegi jika panjang sisinya diketahui?"
      },
      {
        template: "Urutkan langkah-langkah untuk {task}: {step1}, {step2}, {step3}.",
        example: "Urutkan langkah-langkah untuk memecahkan persamaan linear: isolasi variabel, sederhanakan ruas, hitung nilai."
      }
    ]
  },
  
  // Strategy 10: Analytical/Multistep Reasoning
  ANALYTICAL: {
    id: 'analytical',
    priority: 0.03,
    patterns: [
      {
        template: "Analisis pernyataan berikut: '{statement}'. Apakah valid? Berikan alasan!",
        example: "Analisis pernyataan berikut: 'Semua bilangan prima adalah ganjil'. Apakah valid? Berikan alasan!"
      },
      {
        template: "Jika {premise_a} dan {premise_b}, maka kesimpulan yang tepat adalah...",
        example: "Jika semua burung punya sayap dan elang adalah burung, maka kesimpulan yang tepat adalah..."
      }
    ]
  }
};

// =====================================================
// CONTEXT GENERATOR (No Repetitive Templates)
// =====================================================

const ContextGenerators = {
  // Mathematics contexts
  math: {
    settings: [
      "Perhitungan anggaran keluarga",
      "Denah rumah dan ukuran ruangan", 
      "Transaksi jual beli di pasar",
      "Pengukuran lahan pertanian",
      "Perencanaan proyek konstruksi",
      "Statistik penjualan harian",
      "Rasio bahan makanan untuk resep",
      "Waktu tempuh perjalanan",
      "Konversi satuan pengukuran",
      "Distribusi uang saku"
    ],
    
    subjects: [
      "Seorang ibu memasak untuk {count} orang anggota keluarga",
      "Guru membagikan {count} buku kepada siswa",
      "Penjahit memerlukan kain sepanjang {length} meter",
      "Petani menanam pohon sejajar dengan jarak {spacing} meter",
      "Tukang bangunan memasang keramik berukuran {size} cm²"
    ]
  },
  
  // Science contexts
  science: {
    settings: [
      "Eksperimen laboratorium",
      "Observasi alam sekitar",
      "Proses biologis sehari-hari",
      "Fenomena cuaca",
      "Interaksi ekosistem",
      "Pengukuran suhu tubuh",
      "Gerak benda dalam kehidupan",
      "Reaksi kimia dapur",
      "Siklus hidup organisme",
      "Energi dalam aktivitas fisik"
    ],
    
    scenarios: [
      "Ketika memanaskan air hingga mendidih...",
      "Pada proses fotosintesis di daun...",
      "Saat gerhana bulan terjadi...",
      "Dalam percobaan elektrolisis...",
      "Ketika besi berkarat terkena udara..."
    ]
  },
  
  // Social Studies contexts
  social: {
    settings: [
      "Kehidupan masyarakat tradisional",
      "Kondisi ekonomi kota vs desa",
      "Sejarah pergerakan nasional",
      "Hubungan perdagangan internasional",
      "Dinamika kependudukan",
      "Kebijakan pemerintah daerah",
      "Budaya lokal berbagai daerah",
      "Sistem pemerintahan",
      "Hak dan kewajiban warga negara",
      "Globalisasi dan dampaknya"
    ]
  }
};

// =====================================================
// MAIN QUESTION ENGINE CLASS
// =====================================================

class QuestionEngine {
  constructor(subject, difficultyLevel, curriculumData) {
    this.subject = subject;
    this.difficulty = difficultyLevel || 'Medium';
    this.curriculum = curriculumData;
    this.contextPool = this._selectContextPool(subject);
    this.strategyWeights = this._calculateStrategyWeights();
  }
  
  _selectContextPool(subject) {
    if (['Matematika', 'Fisika', 'Kimia'].includes(subject)) return ContextGenerators.math;
    if (['Biologi', 'IPA'].includes(subject)) return ContextGenerators.science;
    if (['Ekonomi', 'Geografi', 'Sejarah', 'Sosiologi'].includes(subject)) return ContextGenerators.social;
    return ContextGenerators.math; // Default fallback
  }
  
  _calculateStrategyWeights() {
    // Weighted random selection based on strategy priority
    const totalPriority = Object.values(QuestionStrategies).reduce((sum, strat) => sum + strat.priority, 0);
    const weights = {};
    let cumWeight = 0;
    
    Object.entries(QuestionStrategies).forEach(([key, strat]) => {
      cumWeight += strat.priority;
      weights[key] = cumWeight / totalPriority;
    });
    
    return weights;
  }
  
  _selectStrategy() {
    const rand = Math.random();
    const strategies = Object.keys(QuestionStrategies);
    for (let i = 0; i < strategies.length; i++) {
      if (rand <= this.strategyWeights[strategies[i]]) {
        return QuestionStrategies[strategies[i]];
      }
    }
    return QuestionStrategies.DIRECT_QUESTIONS;
  }
  
  _generateNaturalQuestion(strategy, topic, variant) {
    const patternIndex = (variant + Math.floor(Math.random() * 10)) % strategy.patterns.length;
    const template = strategy.patterns[patternIndex].template;
    
    // Fill in template with dynamic content
    const filledTemplate = this._fillTemplate(template, topic, variant);
    
    return {
      question: filledTemplate,
      strategy: strategy.id,
      originalTemplate: template
    };
  }
  
  _fillTemplate(template, topic, variant) {
    // Replace {placeholder} with dynamic values
    return template
      .replace(/\{operation\}/g, this._generateOperation(variant))
      .replace(/\{expression\}/g, this._generateExpression(variant))
      .replace(/\{equation\}/g, this._generateEquation(variant))
      .replace(/\{variable\}/g, ['x', 'y', 'z'][variant % 3])
      .replace(/\{subject_name\}/g, ['Rina', 'Budi', 'Ani', 'Dedi', 'Siti'][variant % 5])
      .replace(/\{profession\}/g, ['pengecer', 'petani', 'tukang', 'guru', 'ds'][(variant * 2) % 5])
      .replace(/\{count\}/g, String(5 + variant % 50))
      .replace(/\{length\}/g, String(3 + variant % 20))
      .replace(/\{item\}/g, ['buku', 'pensil', 'kertas', 'kotak', 'keramik'][variant % 5]);
  }
  
  _generateOperation(variant) {
    const operations = [
      `${10 + variant % 100} + ${20 + variant % 50}`,
      `${50 + variant % 200} - ${10 + variant % 30}`,
      `${8 + variant % 20} × ${6 + variant % 15}`
    ];
    return operations[variant % 3];
  }
  
  _generateExpression(variant) {
    const expressions = [
      `${2 + variant % 10}²`,
      `${Math.pow(2, 3 + variant % 5)}`,
      `√${(3 + variant % 100)}²`
    ];
    return expressions[variant % 3];
  }
  
  _generateEquation(variant) {
    const x = 1 + variant % 10;
    const b = 2 + variant % 20;
    const c = 3 + variant % 30;
    const ops = ['+', '-'][variant % 2];
    return `${x}${ops}${b} = ${c}`;
  }
  
  generate(topicName, count = 50, variant = 0) {
    const questions = [];
    
    for (let i = 0; i < count; i++) {
      const strategy = this._selectStrategy();
      
      questions.push({
        id: `Q_${topicName}_${variant}_${i}`,
        ...this._generateNaturalQuestion(strategy, topicName, variant),
        difficulty: this._assignDifficulty(i, variant),
        topic: topicName,
        subject: this.subject,
        variationGroup: variant
      });
    }
    
    return questions;
  }
  
  _assignDifficulty(index, variant) {
    // Distribute difficulty naturally
    if ((index + variant) % 10 === 0) return 'Easy';
    if ((index + variant) % 7 === 0) return 'Hard';
    return 'Medium';
  }
}

export { QuestionEngine, QuestionStrategies };
