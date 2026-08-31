/**
 * QUALITY ANALYZER v1.0
 * 
 * Analyzes quality metrics for extracted question bank.
 * Measures opening patterns, structure diversity, duplicates, and template scores.
 */

import { normalizeText } from '../utils/text-utils';

interface AnalysisOptions {
  sample?: boolean;
  maxRows?: number;
  subjectFilter?: string;
}

interface QualityMetrics {
  openingFrequency: Map<string, number>;
  templatePatterns: Map<string, number>;
  exactDuplicates: number;
  nearDuplicateCount: number;
  avgQuestionLength: number;
  avgOpsiLength: number;
  structureDistribution: Map<string, number>;
  lengthDistribution: {
    short: number;   // < 50 chars
    medium: number;  // 50-150 chars
    long: number;    // > 150 chars
  };
  complexityScore: number; // 0-100 based on various factors
}

export class QualityAnalyzer {
  private readonly OPENING_PATTERNS = [
    /^dalam/i,
    /^sebuah/i,
    /^suatu/i,
    /^perhatikan/i,
    /^manakah/i,
    /^hitunglah/i,
    /^hitung/i,
    /^berapakah/i,
    /^tentukan/i,
    /^jika/i,
    /^dengan/i,
    /^gunakan/i,
    /^seorang/i,
    /^pada/i,
    /^dari/i,
    /^berdasarkan/i,
    /^analisis/i,
    /^baca/i,
    /^lihat/i,
    /^diberikan/i,
    /^dilansir/i,
    /^menurut/i,
    /^sederhanakan/i,
    /^nyatakan/i,
    /^buktikan/i
  ];

  private readonly TEMPLATE_INDICATORS = [
    'Dalam...',
    'Sebuah...',
    'Suatu...',
    'Perhatikan gambar...',
    'Berdasarkan tabel...',
    'Diketahui bahwa...',
    'Jika diketahui...',
    'Dengan menggunakan...',
    'Manakah yang benar...',
    'Hitunglah nilai...'
  ];

  /**
   * Main analysis method
   */
  async analyze(
    questions: Array<{ [key: string]: any }>,
    options: AnalysisOptions = {}
  ): Promise<QualityMetrics> {
    // Ensure questions is a valid array
    if (!Array.isArray(questions)) {
      console.log('⚠️ Questions is not an array, returning empty metrics');
      return {
        openingFrequency: new Map(),
        templatePatterns: new Map(),
        exactDuplicates: 0,
        nearDuplicateCount: 0,
        avgQuestionLength: 0,
        avgOpsiLength: 0,
        structureDistribution: new Map(),
        lengthDistribution: { short: 0, medium: 0, long: 0 },
        complexityScore: 0
      };
    }
    
    console.log(`🔬 Analyzing ${questions.length} questions...`);

    const metrics: QualityMetrics = {
      openingFrequency: new Map(),
      templatePatterns: new Map(),
      exactDuplicates: 0,
      nearDuplicateCount: 0,
      avgQuestionLength: 0,
      avgOpsiLength: 0,
      structureDistribution: new Map(),
      lengthDistribution: { short: 0, medium: 0, long: 0 },
      complexityScore: 0
    };

    if (questions.length === 0) {
      return metrics;
    }

    // Collect all metrics in parallel
    const questionLengths: number[] = [];
    const opsiLengths: number[][] = [];
    const normalizedQuestions: Set<string> = new Set();
    
    for (const q of questions) {
      const questionText = q.question || q.statement || '';
      const optionA = q.optionA || q.options?.A || '';
      const optionB = q.optionB || q.options?.B || '';
      const optionC = q.optionC || q.options?.C || '';
      const optionD = q.optionD || q.options?.D || '';

      // Track question lengths
      questionLengths.push(questionText.length);

      // Track option lengths
      opsiLengths.push([
        optionA.length,
        optionB.length,
        optionC.length,
        optionD.length
      ]);

      // Analyze opening patterns
      this._analyzeOpening(questionText, metrics.openingFrequency);

      // Detect template patterns
      this._detectTemplates(questionText, metrics.templatePatterns);

      // Classify structure
      this._classifyStructure(questionText, metrics.structureDistribution);

      // Length distribution
      this._classifyLength(questionText.length, metrics.lengthDistribution);

      // Track for duplicate detection
      const normalized = normalizeText(questionText);
      normalizedQuestions.add(`${normalized}|${q.correctAnswer}`);
    }

    // Calculate averages
    metrics.avgQuestionLength = questionLengths.reduce((a, b) => a + b, 0) / questionLengths.length;
    
    const allOpsiLengths = opsiLengths.flat();
    metrics.avgOpsiLength = allOpsiLengths.reduce((a, b) => a + b, 0) / allOpsiLengths.length;

    // Detect duplicates
    metrics.exactDuplicates = questions.length - normalizedQuestions.size;
    metrics.nearDuplicateCount = await this._detectNearDuplicates(questions);

    // Calculate complexity score
    metrics.complexityScore = this._calculateComplexity(metrics, questions);

    return metrics;
  }

  /**
   * Analyze opening phrase patterns
   */
  private _analyzeOpening(text: string, frequencyMap: Map<string, number>) {
    const firstSentence = text.split(/[.!?]/)[0].trim();
    
    // Get first 2-3 words as pattern signature
    const words = firstSentence.split(/\s+/).slice(0, 3);
    const signature = words.join(' ');

    // Check against known patterns
    for (const pattern of this.OPENING_PATTERNS) {
      if (pattern.test(firstSentence)) {
        const matchedPattern = firstSentence.match(pattern)?.[0] || words[0];
        frequencyMap.set(matchedPattern, (frequencyMap.get(matchedPattern) || 0) + 1);
        return;
      }
    }

    // Default: use first word
    const defaultPattern = words[0] || 'OTHER';
    frequencyMap.set(defaultPattern, (frequencyMap.get(defaultPattern) || 0) + 1);
  }

  /**
   * Detect template-like patterns
   */
  private _detectTemplates(text: string, templatesMap: Map<string, number>) {
    for (const template of this.TEMPLATE_INDICATORS) {
      if (text.includes(template)) {
        templatesMap.set(template, (templatesMap.get(template) || 0) + 1);
      }
    }
  }

  /**
   * Classify question structure type
   */
  private _classifyStructure(text: string, distributionMap: Map<string, number>) {
    const lowerText = text.toLowerCase();
    
    // Direct calculation
    if (/hitung|hitungan|nilai|hasil|berapa/i.test(lowerText) && 
        /\d+\s*[+\-×÷^]|persen|\%|persen/i.test(lowerText)) {
      distributionMap.set('DIRECT_CALCULATION', (distributionMap.get('DIRECT_CALCULATION') || 0) + 1);
      return;
    }

    // Word problem
    if (/cerita|kasus|situasi|skenario|konteks|dalam kehidupan/i.test(lowerText)) {
      distributionMap.set('WORD_PROBLEM', (distributionMap.get('WORD_PROBLEM') || 0) + 1);
      return;
    }

    // Multiple choice reasoning
    if (/manakah|pilih|yang benar|yang tepat|tidak benar/i.test(lowerText)) {
      distributionMap.set('MULTIPLE_CHOICE_REASONING', (distributionMap.get('MULTIPLE_CHOICE_REASONING') || 0) + 1);
      return;
    }

    // Data interpretation
    if (/grafik|tabel|diagram|data|statistik|informasi/i.test(lowerText)) {
      distributionMap.set('DATA_INTERPRETATION', (distributionMap.get('DATA_INTERPRETATION') || 0) + 1);
      return;
    }

    // Case study
    if (/studi kasus|kajian|analisis mendalam|ihtisar/i.test(lowerText)) {
      distributionMap.set('CASE_STUDY', (distributionMap.get('CASE_STUDY') || 0) + 1);
      return;
    }

    // Pattern recognition
    if (/pola|barisan|deret|lanjutan/i.test(lowerText)) {
      distributionMap.set('PATTERN_RECOGNITION', (distributionMap.get('PATTERN_RECOGNITION') || 0) + 1);
      return;
    }

    // Error analysis
    if (/kesalahan|salah|tata|konsep|miskonsepsi/i.test(lowerText)) {
      distributionMap.set('ERROR_ANALYSIS', (distributionMap.get('ERROR_ANALYSIS') || 0) + 1);
      return;
    }

    // Comparison/Comparison
    if (/bandingkan|lebih besar|lebih kecil|terbesar|terkecil/i.test(lowerText)) {
      distributionMap.set('COMPARISON', (distributionMap.get('COMPARISON') || 0) + 1);
      return;
    }

    // Default
    distributionMap.set('STANDARD', (distributionMap.get('STANDARD') || 0) + 1);
  }

  /**
   * Classify question by length
   */
  private _classifyLength(length: number, distribution: { short: number; medium: number; long: number }) {
    if (length < 50) {
      distribution.short++;
    } else if (length <= 150) {
      distribution.medium++;
    } else {
      distribution.long++;
    }
  }

  /**
   * Detect near-duplicate questions using semantic similarity
   */
  private async _detectNearDuplicates(questions: Array<{ [key: string]: any }>): Promise<number> {
    let count = 0;
    const processedIndices = new Set<number>();

    for (let i = 0; i < questions.length; i++) {
      if (processedIndices.has(i)) continue;

      const q1 = questions[i];
      const text1 = q1.question || q1.statement || '';
      const normalized1 = this._normalizeForComparison(text1);

      let similarCount = 0;

      for (let j = i + 1; j < questions.length; j++) {
        if (processedIndices.has(j)) continue;

        const q2 = questions[j];
        const text2 = q2.question || q2.statement || '';
        const normalized2 = this._normalizeForComparison(text2);

        // Check similarity
        const similarity = this._computeSimilarity(normalized1, normalized2);
        
        if (similarity > 0.75) { // High similarity threshold
          similarCount++;
          processedIndices.add(j);
        }
      }

      if (similarCount > 0) {
        count += similarCount;
        processedIndices.add(i);
      }
    }

    return count;
  }

  /**
   * Normalize text for comparison
   */
  private _normalizeForComparison(text: string): string {
    return text
      .toLowerCase()
      .replace(/[\n\r\t\s]+/g, ' ')
      .replace(/[^\w\s\u0600-\u06FF\u0E00-\u0E7F\-\.]/g, '')
      .trim();
  }

  /**
   * Compute similarity between two texts using Jaccard similarity
   */
  private _computeSimilarity(text1: string, text2: string): number {
    const set1 = new Set(text1.split(/\s+/).filter(w => w.length > 2));
    const set2 = new Set(text2.split(/\s+/).filter(w => w.length > 2));

    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate overall complexity score
   */
  private _calculateComplexity(metrics: QualityMetrics, questions: any[]): number {
    let score = 0;

    // Opening diversity factor (max 30 points)
    const uniqueOpenings = metrics.openingFrequency.size;
    const openingScore = Math.min(uniqueOpenings / 10, 1) * 30;
    score += openingScore;

    // Structure diversity factor (max 30 points)
    const uniqueStructures = metrics.structureDistribution.size;
    const structureScore = Math.min(uniqueStructures / 15, 1) * 30;
    score += structureScore;

    // Template avoidance factor (max 20 points)
    const totalTemplate = Array.from(metrics.templatePatterns.values()).reduce((a, b) => a + b, 0);
    const templateRate = totalTemplate / questions.length;
    const templateScore = Math.max(0, (1 - templateRate) * 20);
    score += templateScore;

    // Duplicate penalty (max -20 points)
    const duplicateRate = (metrics.exactDuplicates + metrics.nearDuplicateCount) / questions.length;
    const duplicatePenalty = -Math.min(duplicateRate * 100, 20);
    score += duplicatePenalty;

    // Question length factor (max 20 points)
    const idealLengthRange = 60; // ±60 characters from avg
    const lengthScore = Math.min(metrics.avgQuestionLength / idealLengthRange, 1) * 20;
    score += lengthScore;

    return Math.max(0, Math.min(100, score));
  }
}
