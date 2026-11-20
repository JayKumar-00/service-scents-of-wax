export const generateAttributeSummary = (variant: Record<string, string>) => {
  return Object.keys(variant)
    .sort() // Important for consistency
    .map((key) => `${key}:${variant[key]}`)
    .join('|');
};
