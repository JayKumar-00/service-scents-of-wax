export type SearchField =
  | string
  | {
      path: string;
      type: 'string' | 'array';
    };

export type TextSearchStrategy = 'prisma' | 'mongoose';

export interface TextSearchOptions {
  search?: string;
  fields: string[];
  strategy?: TextSearchStrategy;
  operator?: 'and' | 'or';
  exact?: boolean;
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSearchTerm = (search?: string): string | undefined => {
  const term = search?.trim();
  return term ? term : undefined;
};

const parseSearchTerms = (search: string): string[] => {
  const tokens: string[] = [];
  const regex = /"([^"]+)"|'([^']+)'|([^\s"']+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(search)) !== null) {
    const [, doubleQuoted, singleQuoted, bare] = match;
    tokens.push(doubleQuoted ?? singleQuoted ?? bare);
  }

  return tokens.map((t) => t.trim()).filter(Boolean);
};

const buildMongooseLikeFilter = (
  search: string,
  fields: string[],
  operator: 'and' | 'or',
  exact = false,
): Record<string, unknown> => {
  const terms = parseSearchTerms(search);

  if (terms.length === 0 || fields.length === 0) return {};

  const makeRegex = (term: string) => {
    const escaped = escapeRegExp(term);
    if (exact) {
      return `^${escaped}$`;
    }
    return escaped;
  };

  if (operator === 'and') {
    return {
      $and: terms.map((term) => ({
        $or: fields.map((field) => ({
          [field]: { $regex: makeRegex(term), $options: 'i' },
        })),
      })),
    };
  }

  const alternation = terms.map((t) => makeRegex(t)).join('|');
  return {
    $or: fields.map((field) => ({
      [field]: { $regex: alternation, $options: 'i' },
    })),
  };
};

export const buildTextSearchFilter = ({
  search,
  fields,
  strategy = 'prisma',
  operator = 'or',
  exact = false,
}: TextSearchOptions): Record<string, unknown> => {
  const term = normalizeSearchTerm(search);

  if (!term || fields.length === 0) {
    return {};
  }

  if (strategy === 'mongoose') {
    return buildMongooseLikeFilter(term, fields, operator, exact);
  }

  const terms = parseSearchTerms(term);

  const buildFieldFilter = (
    field: string,
    t: string,
  ): Record<string, unknown> => {
    const parts = field.split('.');
    const root: Record<string, any> = {};
    let cursor: Record<string, any> = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) {
        cursor[p] = exact
          ? { equals: t, mode: 'insensitive' }
          : { contains: t, mode: 'insensitive' };
      } else {
        cursor[p] = {};
        cursor = cursor[p];
      }
    }
    return root;
  };

  if (operator === 'and') {
    return {
      AND: terms.map((termItem) => ({
        OR: fields.map((f) => buildFieldFilter(f, termItem)),
      })),
    };
  }

  // operator === 'or'
  return {
    OR: terms.flatMap((termItem) =>
      fields.map((f) => buildFieldFilter(f, termItem)),
    ),
  };
};

export const buildPrismaTextSearchFilter = (
  search: string | undefined,
  fields: string[],
): Record<string, unknown> =>
  buildTextSearchFilter({ search, fields, strategy: 'prisma' });

export const buildMongooseTextSearchFilter = (
  search: string | undefined,
  fields: string[],
  operator: 'and' | 'or' = 'or',
  exact = false,
): Record<string, unknown> =>
  buildTextSearchFilter({
    search,
    fields,
    strategy: 'mongoose',
    operator,
    exact,
  });

export const buildPrismaProductTextSearchFilter = (search?: string) => {
  if (!search) return {};

  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return {};

  const fields = [
    'name',
    'slug',
    'description',
    'brandRef.name',
    'category.name',
    'category.parent.name',
    'category.parent.parent.name',
    'seo.title',
  ];

  return {
    AND: terms.map((t) => ({
      OR: [
        ...fields.map((f) => {
          const parts = f.split('.');
          const root: Record<string, any> = {};
          let cursor: Record<string, any> = root;
          for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (i === parts.length - 1) {
              cursor[p] = { contains: t, mode: 'insensitive' };
            } else {
              cursor[p] = {};
              cursor = cursor[p];
            }
          }
          return root;
        }),
        { seo: { keywords: { has: t } } },
        { seo: { tags: { has: t } } },
      ],
    })),
  };
};
