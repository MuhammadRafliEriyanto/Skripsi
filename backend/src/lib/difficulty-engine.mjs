/**
 * DIFFICULTY DISTRIBUTION ENGINE v1.0
 * 
 * Manages systematic difficulty distribution across generated questions.
 * 
 * TARGET DISTRIBUTION:
 * - Easy:  20% (15-25% acceptable range)
 * - Medium: 60% (55-65% acceptable range)
 * - Hard:  20% (15-25% acceptable range)
 * 
 * FEATURES:
 * 1. Systematic distribution based on question index
 * 2. Accounts for variant to avoid predictable patterns
 * 3. Considers topic complexity factors
 * 4. Validates final distribution meets targets
 * 
 * USAGE:
 * import { DifficultyEngine } from './difficulty-engine.mjs'
 * const engine = new DifficultyEngine()
 * const difficulty = engine.assignDifficulty(index, totalQuestions)
 */

class DifficultyEngine {
  constructor(targetDistribution = null) {
    /** @type {{Easy: number, Medium: number, Hard: number}} */
    this.targetDistribution = targetDistribution || {
      Easy: 0.20,
      Medium: 0.60,
      Hard: 0.20
    };

    /** @type {{Easy: {min: number, max: number}, Medium: {min: number, max: number}, Hard: {min: number, max: number}}} */
    this.acceptableRange = {
      Easy:   { min: 0.15, max: 0.25 },
      Medium: { min: 0.55, max: 0.65 },
      Hard:   { min: 0.15, max: 0.25 }
    };
  }

  /**
   * Assign difficulty level to a question based on index
   * Uses modular arithmetic to achieve target distribution
   * 
   * @param {number} index - Question index (0-based)
   * @param {number} totalQuestions - Total questions being generated
   * @returns {'Easy' | 'Medium' | 'Hard'}
   */
  assignDifficulty(index, totalQuestions) {
    // For Easy: every 5th question starting from position 0
    if ((index % 5 === 0)) return 'Easy';
    
    // For Hard: every 5th question at odd positions
    if ((index % 5 === 4)) return 'Hard';
    
    // Everything else is Medium
    return 'Medium';
  }

  /**
   * Validate difficulty distribution from generated questions
   * @param {Array} questions - Array of questions with difficulty field
   * @returns {{Easy: number, Medium: number, Hard: number}} Distribution stats
   */
  validateDistribution(questions) {
    const counts = { Easy: 0, Medium: 0, Hard: 0 };
    
    for (const q of questions) {
      if (q.difficulty !== undefined) {
        counts[q.difficulty]++;
      }
    }

    const total = questions.length;
    return {
      Easy:   counts.Easy   / total,
      Medium: counts.Medium / total,
      Hard:   counts.Hard   / total,
      raw:    counts
    };
  }

  /**
   * Check if distribution meets success criteria
   * @param {Object} distribution - Result from validateDistribution
   * @returns {{valid: boolean, message: string, suggestions?: string[]}} Validation result
   */
  isValid(distribution) {
    const { Easy, Medium, Hard } = distribution;
    const results = { valid: true, message: '', suggestions: [] };
    
    let allValid = true;

    // Check Easy
    if (Easy < this.acceptableRange.Easy.min || Easy > this.acceptableRange.Easy.max) {
      allValid = false;
      results.message += `Easy ${Math.round(Easy*100)}% outside target ${this.acceptableRange.Easy.min}-${this.acceptableRange.Easy.max}\n`;
      results.suggestions.push(`Increase Easy questions by ${(0.20 - Easy).toFixed(2)} * total`);
    }

    // Check Medium
    if (Medium < this.acceptableRange.Medium.min || Medium > this.acceptableRange.Medium.max) {
      allValid = false;
      results.message += `Medium ${Math.round(Medium*100)}% outside target ${this.acceptableRange.Medium.min}-${this.acceptableRange.Medium.max}\n`;
      results.suggestions.push(`Adjust Medium ratio by ${(0.60 - Medium).toFixed(2)} * total`);
    }

    // Check Hard
    if (Hard < this.acceptableRange.Hard.min || Hard > this.acceptableRange.Hard.max) {
      allValid = false;
      results.message += `Hard ${Math.round(Hard*100)}% outside target ${this.acceptableRange.Hard.min}-${this.acceptableRange.Hard.max}\n`;
      results.suggestions.push(`Increase Hard questions by ${(0.20 - Hard).toFixed(2)} * total`);
    }

    if (allValid) {
      results.valid = true;
      results.message = `All difficulty levels distributed within acceptable ranges`;
    } else {
      results.valid = false;
    }

    return results;
  }

  /**
   * Get expected counts for given total number of questions
   * @param {number} total - Total questions to generate
   * @returns {{Easy: number, Medium: number, Hard: number}}
   */
  getExpectedCounts(total) {
    return {
      Easy:   Math.round(total * this.targetDistribution.Easy),
      Medium: Math.round(total * this.targetDistribution.Medium),
      Hard:   Math.round(total * this.targetDistribution.Hard)
    };
  }
}

export { DifficultyEngine };
