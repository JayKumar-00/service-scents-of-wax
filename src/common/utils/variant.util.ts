/**
 * Formats variant attribute summaries (e.g. "Color:Red|Size:M") into
 * "COLOR-RED, SIZE-M".
 */
export function formatVariantName(attributeSummary: string | null | undefined): string | null {
  if (!attributeSummary) return null;
  return attributeSummary
    .split('|')
    .map((part) => {
      const colonIndex = part.indexOf(':');
      if (colonIndex !== -1) {
        const key = part.slice(0, colonIndex).trim().toUpperCase();
        const val = part.slice(colonIndex + 1).trim().toUpperCase();
        return `${key}-${val}`;
      }
      return part.trim().toUpperCase();
    })
    .filter(Boolean)
    .join(', ');
}
