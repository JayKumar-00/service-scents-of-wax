export function buildMongoQuery(keywords: string[]) {
  if (!keywords.length) return {};

  const regex = new RegExp(keywords.join('|'), 'i');

  return {
    $or: [
      { title: regex },
      { sub_title: regex },
      { description: regex },
      { sku: regex },
      { 'seo.keywords': regex },
      {
        explicitAttributes: {
          $elemMatch: {
            value: regex,
          },
        },
      },
    ],
  };
}
