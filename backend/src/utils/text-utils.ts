/**
 * TEXT UTILITIES
 * 
 * Helper functions for text normalization and processing
 */

/**
 * Normalize text for comparison by removing noise
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\u0600-\u06FF\u0E00-\u0E7F\-\.]/g, '')
    .trim();
}

/**
 * Extract first sentence from text
 */
export function extractFirstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0] : text.split('\n')[0];
}

/**
 * Extract first N words from text
 */
export function extractNWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/).slice(0, n);
  return words.join(' ');
}

/**
 * Check if text contains numbers
 */
export function containsNumbers(text: string): boolean {
  return /\d+/.test(text);
}

/**
 * Check if text is mathematical (contains formulas)
 */
export function isMathematical(text: string): boolean {
  const mathPatterns = [
    /[\^×÷±≤≥<>]/,
    /[+\-×÷()]/,
    /sqrt\(|√|fraction|persen|\%/
  ];
  
  return mathPatterns.some(pattern => pattern.test(text));
}

/**
 * Calculate text similarity using Jaccard index
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const set1 = new Set(normalizeText(text1).split(/\s+/).filter(w => w.length > 2));
  const set2 = new Set(normalizeText(text2).split(/\s+/).filter(w => w.length > 2));
  
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}
