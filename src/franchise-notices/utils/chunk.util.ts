/**
 * Split array into chunks of given size.
 * Uses a simple for-loop to avoid generating large intermediate arrays.
 */
export function chunkArray<T>(arr: T[], size = 500): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}
