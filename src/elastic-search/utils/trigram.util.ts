export function generateTrigrams(text: string): string[] {
  const tokens: string[] = [];

  for (let i = 0; i < text.length - 2; i++) {
    tokens.push(text.substring(i, i + 3));
  }

  return tokens;
}
