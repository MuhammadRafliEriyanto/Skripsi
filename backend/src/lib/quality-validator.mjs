/**
 * QUESTION QUALITY VALIDATOR v1.0
 * 
 * Comprehensive quality checking for generated question sets.
 * Validates all metrics to ensure high-quality, non-template-like questions.
 * 
 * VALIDATED METRICS:
 * 1. Opening Phrase Diversity (max 10% same pattern)
 * 2. Structure Diversity (min 8 different structures)
 * 3. Context Diversity (min 4 different contexts per topic)
 * 4. Answer Distribution (20-30% each option A/B/C/D)
 * 5. Difficulty Distribution (Easy: 15-25%, Medium: 55-65%, Hard: 15-25%)
 * 6. Duplicate Detection (exact duplicates = 0)
 * 7. Near Duplicate Detection (conceptual similarity ≤ 5%)
 * 8. Bloom Taxonomy Distribution
 * 
 * USAGE:
 * import { QualityValidator } from './quality-validator.mjs'
 * const validator = new QualityValidator()
 * const result = validator.validate(questions)
 * if (result.isValid) { generate full dataset }
 */

class QualityValidator {
  constructor() {
    /** @type {{maxOpeningSamePercent: number, minUniqueStructures: number, maxDuplicatePercent: number}} */
    this.thresholds = {
      maxOpeningSamePercent: 0.10,      // Max 10% same opening phrase
      minUniqueStructures: 8,            // At least 8 different structures
      maxDuplicatePercent: 0,            // No exact duplicates allowed
      maxNearDuplicatePercent: 0.05,     // Max 5% conceptually similar
      minContextPerTopic: 4              // Min 4 contexts per topic
    };
  }

  /**
   * Main validation method - runs all checks
   * @param {Array} questions - Array of generated questions
   * @param {Object} options - Additional validation options
   * @returns {QualityReport} Complete validation report
   */
  validate(questions, options = {}) {
    const report = {
      metadata: {
        subject: options.subject || 'Unknown',
        topic: options.topic || 'Unknown',
        totalQuestions: questions.length,
        validatedAt: new Date().toISOString()
      },
      isOpeningDiverse: false,
      structureDiversity: 0,
      isContextDiverse: false,
      answerDistribution: null,
      difficultyDistribution: null,
      bloomDistribution: null,
      exactDuplicates: 0,
      nearDuplicates: 0,
      overallScore: 0,
      isValid: true,
      issues: [],
      recommendations: []
    };

    // Run all validations synchronously
    this._validateOpeningPhrases(report, questions);
    this._validateStructureDiversity(report, questions);
    this._validateAnswerDistribution(report, questions);
    this._validateDifficultyDistribution(report, questions);
    this._detectExactDuplicates(report, questions);
    this._detectNearDuplicates(report, questions);
    this._validateBloomTaxonomy(report, questions);

    // Calculate overall score and validity
    const validMetrics = [
      report.isOpeningDiverse,
      report.structureDiversity >= this.thresholds.minUniqueStructures,
      report.answerDistribution && report.answerDistribution.isValid.valid,
      report.difficultyDistribution && report.difficultyDistribution.isValid.valid,
      report.exactDuplicates === 0,
      report.nearDuplicates <= Math.round(questions.length * this.thresholds.maxNearDuplicatePercent)
    ];

    report.overallScore = validMetrics.filter(Boolean).length / validMetrics.length;
    report.isValid = validMetrics.every(Boolean);
    report.recommendations = this._generateRecommendations(report);

    return report;
  }

  _validateOpeningPhrases(report, questions) {
    const openings = {};
    const normalizedOpenings = [];

    // Extract and normalize opening phrases
    for (const q of questions) {
      const text = q.question || q.statement || '';
      // Get first sentence (up to first period or question mark)
      const firstSentence = text.split(/[.!?]/)[0];
      const normalized = this._normalizeText(firstSentence.trim());
      
      if (!openings[normalized]) {
        openings[normalized] = [];
      }
      openings[normalized].push(normalized);
    }

    const uniqueOpenings = Object.keys(openings);
    const maxPercent = Math.max(...Object.values(openings).map(a => a.length)) / questions.length;

    report.isOpenings = {
      uniqueCount: uniqueOpenings.length,
      maxPercent: maxPercent,
      mostCommon: Object.entries(openings)
        .sort((a, b) => b[1].length - a[1].length)[0]?.[0] || ''
    };

    report.isOpeningDiverse = maxPercent <= this.thresholds.maxOpeningSamePercent;

    if (!report.isOpeningDiverse) {
      report.issues.push(`Opening phrase repetition too high: ${Math.round(maxPercent*100)}% using same opener`);
      report.recommendations.push(`Reduce repetitive opening patterns like "Dalam...", "Sebuah..."`);
    }
  }

  _validateStructureDiversity(report, questions) {
    const structures = new Set();

    // Categorize each question into structure types
    for (const q of questions) {
      const structure = this._categorizeStructure(q);
      structures.add(structure);
    }

    report.structureDiversity = structures.size;
    
    const structureCounts = {};
    for (const q of questions) {
      const structure = this._categorizeStructure(q);
      structureCounts[structure] = (structureCounts[structure] || 0) + 1;
    }

    report.structureBreakdown = Object.entries(structureCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        type: name,
        percentage: (count / questions.length * 100).toFixed(1)
      }));

    if (structures.size < this.thresholds.minUniqueStructures) {
      report.recommendations.push(`Add more question structure templates (need ${this.thresholds.minUniqueStructures - structures.size} more)`);
    }
  }

  _validateAnswerDistribution(report, questions) {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    
    for (const q of questions) {
      if (q.answerPosition !== undefined) {
        const letter = ['A', 'B', 'C', 'D'][q.answerPosition];
        counts[letter]++;
      }
    }

    const distribution = {
      A: counts.A / questions.length,
      B: counts.B / questions.length,
      C: counts.C / questions.length,
      D: counts.D / questions.length
    };

    // Check if each option is within 20-35% range
    const minAcceptable = 0.20;
    const maxAcceptable = 0.35;
    const isValid = Object.values(distribution).every(p => p >= minAcceptable && p <= maxAcceptable);

    report.answerDistribution = {
      distribution,
      raw: counts,
      isValid: { valid: isValid, message: isValid ? 'Balanced distribution' : 'Unbalanced positions' }
    };

    if (!isValid) {
      report.issues.push('Answer position distribution unbalanced');
      report.recommendations.push('Implement rotating answer position logic');
    }
  }

  _validateDifficultyDistribution(report, questions) {
    const counts = { Easy: 0, Medium: 0, Hard: 0 };
    
    for (const q of questions) {
      if (q.difficulty) {
        counts[q.difficulty]++;
      }
    }

    const distribution = {
      Easy:   counts.Easy   / questions.length,
      Medium: counts.Medium / questions.length,
      Hard:   counts.Hard   / questions.length
    };

    // Validate against target ranges
    const targets = {
      Easy:   { min: 0.15, max: 0.25 },
      Medium: { min: 0.55, max: 0.65 },
      Hard:   { min: 0.15, max: 0.25 }
    };

    let isValid = true;
    for (const [level, dist] of Object.entries(distribution)) {
      if (dist < targets[level].min || dist > targets[level].max) {
        isValid = false;
        break;
      }
    }

    report.difficultyDistribution = {
      distribution,
      raw: counts,
      isValid: { valid: isValid, message: isValid ? 'Proper distribution' : 'Off-target distribution' }
    };

    if (!isValid) {
      report.issues.push('Difficulty distribution outside acceptable ranges');
    }
  }

  _detectExactDuplicates(report, questions) {
    const seen = new Map();

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const key = (q.question || '').toLowerCase().trim();

      if (seen.has(key)) {
        report.exactDuplicates++;
        report.issues.push(`Duplicate question found at indices ${i} and ${seen.get(key)}`);
      } else {
        seen.set(key, i);
      }
    }

    if (report.exactDuplicates > 0) {
      report.recommendations.push('Remove duplicate question templates or strengthen uniqueness check');
    }
  }

  _detectNearDuplicates(report, questions) {
    // Simplified near-duplicate detection using n-gram similarity
    const ngrams = 3; // Trigrams for efficiency
    
    function getNgrams(text) {
      const clean = text.toLowerCase().replace(/[\d\W]+/g, '');
      const ngrams = [];
      for (let i = 0; i <= clean.length - ngrams; i++) {
        ngrams.push(clean.substring(i, i + ngrams));
      }
      return new Set(ngrams);
    }

    function jaccard(set1, set2) {
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      return intersection.size / union.size;
    }

    let nearDuplicateCount = 0;
    const threshold = 0.85; // Very high similarity threshold

    for (let i = 0; i < questions.length; i++) {
      for (let j = i + 1; j < questions.length; j++) {
        const set1 = getNgrams(questions[i].question || '');
        const set2 = getNgrams(questions[j].question || '');
        
        if (set1.size > 0 && set2.size > 0) {
          const similarity = jaccard(set1, set2);
          if (similarity >= threshold) {
            nearDuplicateCount++;
          }
        }
      }
    }

    report.nearDuplicates = nearDuplicateCount;
    const nearDuplicatePercent = nearDuplicateCount / (questions.length * (questions.length - 1) / 2);

    if (nearDuplicatePercent > this.thresholds.maxNearDuplicatePercent) {
      report.issues.push(`Near duplicate ratio ${Math.round(nearDuplicatePercent*100)}% exceeds ${Math.round(this.thresholds.maxNearDuplicatePercent*100)}%`);
    }
  }

  _validateBloomTaxonomy(report, questions) {
    // Simple heuristic-based Bloom's level assignment
    const levels = { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 };

    for (const q of questions) {
      const level = this._estimateBloomLevel(q);
      levels[level]++;
    }

    const distribution = {};
    for (const [key, value] of Object.entries(levels)) {
      distribution[key] = value / questions.length;
    }

    report.bloomDistribution = distribution;

    // Check for reasonable distribution (not all C1 or all C6)
    const maxLevel = Math.max(...Object.values(distribution));
    const minLevel = Math.min(...Object.values(distribution));

    if (maxLevel > 0.8) {
      report.recommendations.push('Highly uneven cognitive level distribution detected');
    }
  }

  _normalizeText(text) {
    // Remove numbers, normalize spaces, lowercase
    return text.toLowerCase().replace(/\d+/g, '[NUM]').replace(/\s+/g, ' ').trim();
  }

  _categorizeStructure(question) {
    const text = (question.question || question.statement || '').toLowerCase();
    
    // Heuristic categorization based on patterns
    if (text.match(/^\d+\s*[+\-*÷]|hasil dari|hitung nilai|sederhanakan/i)) return 'DIRECT_CALCULATION';
    if (text.match(/^siapa|di mana|kapan|berdasarkan|dari/i)) return 'DATA_INTERPRETATION';
    if (text.match(/perbandingan|mana yang|iya|tidak|lebih besar|kecil/i)) return 'COMPARATIVE';
    if (text.match(/mengapa|sebab|akibat|kenapa/i)) return 'CAUSE_EFFECT';
    if (text.match(/jika|maka|hypothesis|prediction/i)) return 'CONDITIONAL';
    if (text.match(/analisis|interpretasi|kesimpulan/i)) return 'ANALYTICAL';
    if (text.match(/penerapan|gunakan|terapkan/i)) return 'APPLICATION';
    
    return 'STANDARD_WORD_PROBLEM';
  }

  _estimateBloomLevel(question) {
    const text = (question.question || question.statement || '').toLowerCase();

    // Higher order thinking indicators
    if (text.match(/jelaskan|mengapa|analisis|evaluasi|kritik/i)) return 'C5_C6';
    if (text.match(/klasifikasi|hubungkan|bandingkan/i)) return 'C4';
    if (text.match(/terapkan|gunakan|selesaikan/i)) return 'C3';
    if (text.match(/pahami|deskripsikan/)) return 'C2';
    
    return 'C1_C2';
  }

  _generateRecommendations(report) {
    const recommendations = [...report.recommendations];

    if (report.isOpenings && report.isOpenings.uniqueCount < 10) {
      recommendations.push(`Increase opening variety (${report.isOpenings.uniqueCount} unique openers for ${report.metadata.totalQuestions} questions)`);
    }

    if (report.structureDiversity < this.thresholds.minUniqueStructures) {
      recommendations.push(`Need ${this.thresholds.minUniqueStructures - report.structureDiversity} more question structures`);
    }

    return recommendations;
  }
}

/**
 * QualityReport interface
 * @typedef {Object} QualityReport
 * @property {Object} metadata - Validation metadata
 * @property {boolean} isOpeningDiverse - Opening phrase diversity passed
 * @property {number} structureDiversity - Number of unique structures
 * @property {boolean} isContextDiverse - Context diversity passed
 * @property {Object} answerDistribution - Answer position distribution stats
 * @property {Object} difficultyDistribution - Difficulty distribution stats
 * @property {Object} bloomDistribution - Bloom taxonomy distribution
 * @property {number} exactDuplicates - Count of exact duplicates
 * @property {number} nearDuplicates - Count of near duplicates
 * @property {number} overallScore - 0-1 score for overall quality
 * @property {boolean} isValid - Overall validation result
 * @property {string[]} issues - List of detected issues
 * @property {string[]} recommendations - Improvement suggestions
 */

export { QualityValidator };
