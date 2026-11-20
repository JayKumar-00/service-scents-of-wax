export const generateSearchText = (
  name: string,
  attrs: Record<string, string>,
) => {
  return [name, ...Object.values(attrs)].join(' ').toLowerCase();
};
