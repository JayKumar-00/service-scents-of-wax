import { randomUUID } from 'crypto';

export const generateSlug = (title: string): string => {
  // Step 1: Normalize title → lowercase, trimmed, safe characters
  const normalized = title
    ?.toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with "-"
    .replace(/-+/g, '-') // collapse multiple "-"
    .replace(/^-+|-+$/g, ''); // trim leading/trailing "-"

  // Step 2: Take only first 2 words for readability
  const base = normalized.split('-').slice(0, 2).join('-');

  // Step 3: Append crypto random string for uniqueness
  const unique = randomUUID();
  return `${base}-${unique}`;
};

export const generateSkuWithoutVariant = (
  title: string,
  stock: number,
): string => {
  // Step 1: Normalize title → lowercase, trimmed, safe characters
  const normalized = title
    ?.toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with "-"
    .replace(/-+/g, '-') // collapse multiple "-"
    .replace(/^-+|-+$/g, ''); // trim leading/trailing "-"

  // Step 2: Take only first 2 words for readability
  const base = normalized.split('-').slice(0, 2).join('-');

  // Step 3: Append crypto random string for uniqueness
  const unique = randomUUID(); // 6-char hex
  return `${base}-${unique}-${stock}`;
};

export const generateSkuWithVariant = (
  name: string,
  attrs: Record<string, string>,
) => {
  const base = name.slice(0, 4).toUpperCase();
  const suffix = Object.values(attrs).join('-').toUpperCase();
  return `${base}-${suffix}`;
};
