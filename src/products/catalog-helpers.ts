type CatRow = { id: string; parentId: string | null; slug: string };

/** All category ids in the subtree rooted at `rootSlug` (including root). Null if slug unknown. */
export function subtreeCategoryIds(
  all: CatRow[],
  rootSlug: string,
): string[] | null {
  const root = all.find((c) => c.slug === rootSlug);
  if (!root) {
    return null;
  }
  const byParent = new Map<string, string[]>();
  for (const c of all) {
    if (c.parentId === null) {
      continue;
    }
    if (!byParent.has(c.parentId)) {
      byParent.set(c.parentId, []);
    }
    byParent.get(c.parentId)!.push(c.id);
  }
  const out: string[] = [];
  const stack = [root.id];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    const kids = byParent.get(id);
    if (kids?.length) {
      stack.push(...kids);
    }
  }
  return out;
}

/** All category ids in the subtree rooted at `rootId` (including root). Null if ID unknown. */
export function subtreeCategoryIdsById(
  all: { id: string; parentId: string | null }[],
  rootId: string,
): string[] | null {
  const exists = all.some((c) => c.id === rootId);
  if (!exists) {
    return null;
  }
  const byParent = new Map<string, string[]>();
  for (const c of all) {
    if (c.parentId === null) {
      continue;
    }
    if (!byParent.has(c.parentId)) {
      byParent.set(c.parentId, []);
    }
    byParent.get(c.parentId)!.push(c.id);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    const kids = byParent.get(id);
    if (kids?.length) {
      stack.push(...kids);
    }
  }
  return out;
}

export function parseCsv(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

