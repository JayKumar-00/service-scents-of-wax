export function addTotalCreditAmount(obj: any, visited = new WeakSet()): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object' || obj instanceof Date || obj instanceof RegExp) {
    return obj;
  }

  // Avoid traversing Node.js Buffers, Streams, or Express Request/Response objects
  if (
    Buffer.isBuffer(obj) ||
    typeof obj.pipe === 'function' ||
    typeof obj.setHeader === 'function'
  ) {
    return obj;
  }

  if (
    obj.constructor &&
    typeof (obj.constructor as any).isDecimal === 'function' &&
    (obj.constructor as any).isDecimal(obj)
  ) {
    return obj;
  }

  // Detect circular references
  if (visited.has(obj)) {
    return obj;
  }
  visited.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => addTotalCreditAmount(item, visited));
  }

  // Shallow copy to prevent mutating the original Prisma object metadata directly
  const result = { ...obj };

  if ('usedCredit' in result && 'advanceBalance' in result) {
    result.totalCreditAmount =
      Number(result.usedCredit || 0) + Number(result.advanceBalance || 0);
  }

  if ('totalCredit' in result && 'advanceBalance' in result) {
    result.overallTotalCredits =
      Number(result.totalCredit || 0) + Number(result.advanceBalance || 0);
  }

  // Traverse nested properties
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (val && typeof val === 'object') {
      result[key] = addTotalCreditAmount(val, visited);
    }
  }

  return result;
}
