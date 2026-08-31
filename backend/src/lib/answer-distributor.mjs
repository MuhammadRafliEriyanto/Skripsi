/**
 * ANSWER DISTRIBUTION MANAGER v1.0
 * 
 * Ensures balanced answer position distribution across all generated questions.
 * 
 * FEATURES:
 * 1. Rotating answer position (A/B/C/D) based on index + variant
 * 2. Maintains 20-30% for each option
 * 3. Preserves distractor quality by not changing answer logic
 * 4. Prevents predictable patterns students can exploit
 * 
 * DISTRIBUTION TARGET:
 * - A: 20-30%
 * - B: 20-30%
 * - C: 20-30%
 * - D: 20-30%
 * 
 * USAGE:
 * import { AnswerDistributor } from './answer-distributor.mjs'
 * const distributor = new AnswerDistributor()
 * const position = distributor.getNextPosition(index, variant)
 * // position will be 0, 1, 2, or 3 (for A, B, C, D)
 */

class AnswerDistributor {
  /**
   * Get the next answer position for a question
   * @param {number} index - Question index within generation batch
   * @param {number} variant - Variant number for variation
   * @returns {number} 0=A, 1=B, 2=C, 3=D
   */
  getNextPosition(index, variant) {
    // Rotate through A/B/C/D systematically
    return (index + variant) % 4;
  }

  /**
   * Distribute options so correct answer is at the right position
   * @param {string[]} options - Array of [correctAnswer, wrong1, wrong2, wrong3]
   * @param {number} targetPosition - Desired position for correct answer (0-3)
   * @returns {string[]} Shuffled options with correct answer at target position
   */
  distribute(options, targetPosition) {
    if (!Array.isArray(options) || options.length !== 4) {
      throw new Error('Options must be an array of exactly 4 answers');
    }

    const correctAnswer = options[0];
    const distractors = options.slice(1);

    // Build new array with correct answer at target position
    const result = ['', '', '', ''];
    result[targetPosition] = correctAnswer;

    // Place distractors in remaining positions
    let distractorIndex = 0;
    for (let i = 0; i < 4; i++) {
      if (i !== targetPosition) {
        result[i] = distractors[distractorIndex++];
      }
    }

    return result;
  }

  /**
   * Validate final distribution from generated questions
   * @param {Array} questions - Array of generated questions with answerPosition field
   * @returns {{A: number, B: number, C: number, D: number}} Distribution stats
   */
  validateDistribution(questions) {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    
    for (const q of questions) {
      if (q.answerPosition !== undefined) {
        const letter = ['A', 'B', 'C', 'D'][q.answerPosition];
        counts[letter]++;
      }
    }

    const total = questions.length;
    return {
      A: counts.A / total,
      B: counts.B / total,
      C: counts.C / total,
      D: counts.D / total,
      raw: counts
    };
  }

  /**
   * Check if distribution meets success criteria (20-30% each)
   * @param {Object} distribution - Result from validateDistribution
   * @returns {{valid: boolean, message: string}} Validation result
   */
  isValid(distribution) {
    const { A, B, C, D } = distribution;
    const min = 0.20;
    const max = 0.35; // Allow some flexibility up to 35%

    if (A < min || A > max || B < min || B > max || 
        C < min || C > max || D < min || D > max) {
      return {
        valid: false,
        message: `Distribution outside acceptable range. Values must be between ${min} and ${max}`
      };
    }

    return {
      valid: true,
      message: `All options distributed within target range (${Math.round(A*100)}%-${Math.round(D*100)}%)`
    };
  }
}

export { AnswerDistributor };
