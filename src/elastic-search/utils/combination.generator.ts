const ALPHABETS = 'abcdefghijklmnopqrstuvwxyz';

export function generateAZVariants(keyword: string): string[] {
  const results = new Set<string>();

  const lower = keyword.toLowerCase();

  // original
  results.add(lower);

  for (const char of ALPHABETS) {
    // prefix → aphone, bphone
    results.add(char + lower);

    // suffix → phonea, phoneb
    results.add(lower + char);

    // middle insert → phaone, phoane
    for (let i = 0; i < lower.length; i++) {
      const variant = lower.slice(0, i) + char + lower.slice(i);
      results.add(variant);
    }
  }

  return Array.from(results);
}

export function expandKeyword(
  keyword: string,
  synonyms: Record<string, string[]>,
) {
  const all = new Set<string>();

  const baseWords = [keyword, ...(synonyms[keyword] || [])];

  for (const word of baseWords) {
    const variants = generateAZVariants(word);
    variants.forEach((v) => all.add(v));
  }

  return Array.from(all);
}
