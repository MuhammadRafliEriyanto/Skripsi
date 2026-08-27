export function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash >>> 0; // unsigned 32-bit integer
}

// Linear Congruential Generator
export function lcg(seed: number) {
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/**
 * Shuffles an array in-place using a string seed.
 * Useful for deterministic shuffling based on an ID (e.g., studentId + questionId).
 */
export function seededShuffle<T>(array: T[], seedString: string): T[] {
  const seed = stringToSeed(seedString);
  const random = lcg(seed);
  
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  
  return array;
}

/**
 * Creates a mapping for A, B, C, D options.
 * Returns an array representing the new order of original options.
 * Example: ["C", "A", "D", "B"] means the new 'A' is the original 'C'.
 */
export function getSeededOptionMapping(studentId: string, questionId: string) {
  const seedString = `${studentId}-${questionId}`;
  const options = ["A", "B", "C", "D"];
  return seededShuffle(options, seedString);
}
