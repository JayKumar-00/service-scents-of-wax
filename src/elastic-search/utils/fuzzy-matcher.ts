import Fuse from 'fuse.js';

/**
 * Calculates Levenshtein distance between two strings
 * Useful for typo detection and correction
 */
export function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix: number[][] = Array(bLen + 1)
    .fill(null)
    .map(() => Array(aLen + 1).fill(0));

  for (let i = 0; i <= aLen; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= bLen; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= bLen; j++) {
    for (let i = 1; i <= aLen; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator,
      );
    }
  }

  return matrix[bLen][aLen];
}

/**
 * Calculates similarity score between two strings (0-1)
 * Based on Levenshtein distance
 */
export function calculateSimilarityScore(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Checks if two strings are a close typo match using Levenshtein distance
 * and industry-standard query length thresholds.
 */
export function isTypoMatch(query: string, target: string, threshold = 0.6): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  if (q === t) return true;
  if (q.length === 0 || t.length === 0) return false;

  // Enforce first letter matching to avoid low-quality prefix substitutions
  if (q[0] !== t[0]) {
    return false;
  }

  const distance = levenshteinDistance(q, t);

  // Enforce industry-standard max edit distance based on query length:
  // - 1-2 chars: 0 edits (exact match only)
  // - 3-5 chars: max 1 edit
  // - > 5 chars: max 2 edits
  const qLen = q.length;
  let maxDistance = 2;
  if (qLen <= 2) {
    maxDistance = 0;
  } else if (qLen <= 5) {
    maxDistance = 1;
  }

  if (distance > maxDistance) {
    return false;
  }

  const maxLen = Math.max(q.length, t.length);
  const similarity = 1 - distance / maxLen;
  return similarity >= threshold;
}

/**
 * Fuzzy search implementation for typo tolerance
 * Returns matching items with relevance scores
 */
export class FuzzyMatcher {
  private fuse: Fuse<any>;
  private data: any[];
  private threshold: number;

  constructor(data: any[], keys: string[] = [], threshold: number = 0.6) {
    this.data = data;
    this.threshold = threshold;

    // Configure Fuse.js for fuzzy matching
    this.fuse = new Fuse(data, {
      keys: keys.length > 0 ? keys : ['name', 'title'],
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      threshold: 1 - threshold, // Fuse uses inverted threshold
      distance: 100,
      ignoreLocation: true,
      useExtendedSearch: true,
    });
  }

  /**
   * Search for matches in the data
   */
  search(
    query: string,
    keys: string[],
  ): Array<{ item: any; score: number; matchedField: string }> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const cleanQuery = query.trim().toLowerCase();
    const results: Map<any, { score: number; matchedField: string }> =
      new Map();

    // Use Fuse.js for fuzzy matching
    const fuseResults = this.fuse.search(cleanQuery);

    fuseResults.forEach((result: any) => {
      const fuseScore = 100 * (1 - (result.score || 1)); // Convert to 0-100 scale

      if (fuseScore >= this.threshold * 100) {
        const matchedField = result.matches?.[0]?.key || 'unknown';
        const matchedValue = result.matches?.[0]?.value || '';

        // Filter out matches that don't respect the query length edit distance constraint
        if (matchedValue && !isTypoMatch(cleanQuery, matchedValue, this.threshold)) {
          const words = matchedValue.toLowerCase().split(/[\s,.\-\/]+/);
          const hasWordMatch = words.some((w: string) => isTypoMatch(cleanQuery, w, this.threshold));
          if (!hasWordMatch) {
            return;
          }
        }

        if (!results.has(result.item)) {
          results.set(result.item, { score: fuseScore, matchedField });
        } else {
          const existing = results.get(result.item)!;
          if (fuseScore > existing.score) {
            results.set(result.item, { score: fuseScore, matchedField });
          }
        }
      }
    });

    // Also perform custom string similarity matching
    const addResult = (item: any, score: number, matchedField: string) => {
      if (!results.has(item)) {
        results.set(item, { score, matchedField });
      } else {
        const existing = results.get(item)!;
        if (score > existing.score) {
          results.set(item, { score, matchedField });
        }
      }
    };

    for (const item of this.data) {
      for (const key of keys) {
        const value = this.getNestedValue(item, key);
        if (value) {
          const valuesToCheck = Array.isArray(value) ? value : [value];
          for (const val of valuesToCheck) {
            const strValue = String(val).toLowerCase();

            if (isTypoMatch(cleanQuery, strValue, this.threshold)) {
              const similarity = calculateSimilarityScore(cleanQuery, strValue);
              addResult(item, similarity * 100, key);
              continue;
            }

            // Multi-word matching
            const queryTerms = cleanQuery.split(/\s+/).filter(Boolean);
            if (queryTerms.length > 1) {
              const targetWords = strValue.split(/[\s,.\-\/]+/);
              const isMatch = queryTerms.every((qTerm) => {
                return targetWords.some((tWord) => {
                  if (tWord.startsWith(qTerm)) return true;
                  if (qTerm.length >= 3 && isTypoMatch(qTerm, tWord, this.threshold)) return true;
                  return false;
                });
              });
              if (isMatch) {
                const similarity = calculateSimilarityScore(cleanQuery, strValue);
                addResult(item, similarity * 100, key);
                continue;
              }
            }

            // Word-by-word matching
            const words = strValue.split(/[\s,.\-\/]+/);
            for (const word of words) {
              if (word.length >= 3) {
                if (isTypoMatch(cleanQuery, word, this.threshold)) {
                  const wordSimilarity = calculateSimilarityScore(cleanQuery, word);
                  addResult(item, wordSimilarity * 100, key);
                  break;
                }
              }
            }
          }
        }
      }
    }

    return Array.from(results.entries()).map(
      ([item, { score, matchedField }]) => ({
        item,
        score,
        matchedField,
      }),
    );
  }

  /**
   * Get nested object value by dot notation key
   */
  private getNestedValue(obj: any, key: string): any {
    return key.split('.').reduce((current, prop) => current?.[prop], obj);
  }
}

/**
 * Common typo corrections mapping
 * Expands to handle more common misspellings
 */
const TYPO_CORRECTIONS: Record<string, string[]> = {
  iphone: ['iphone', 'iphone', 'ifone'],
  samsung: ['samsung', 'sumsung', 'samsang'],
  laptop: ['laptop', 'lapto', 'laptob'],
  mobile: ['mobile', 'mobil', 'moble'],
  shirt: ['shirt', 'shrt', 'shiert'],
  shoe: ['shoe', 'sho', 'sheo'],
  color: ['color', 'colour', 'colr'],
  blue: ['blue', 'bleu', 'bule'],
  black: ['black', 'blck', 'blak'],
  white: ['white', 'whte', 'wihte'],
};

/**
 * Attempts to correct common typos in search query
 */
export function correctTypos(query: string): string {
  let correctedQuery = query.toLowerCase();

  for (const [correct, variations] of Object.entries(TYPO_CORRECTIONS)) {
    for (const variation of variations) {
      const regex = new RegExp(`\\b${variation}\\b`, 'gi');
      if (regex.test(correctedQuery)) {
        correctedQuery = correctedQuery.replace(regex, correct);
      }
    }
  }

  return correctedQuery;
}
