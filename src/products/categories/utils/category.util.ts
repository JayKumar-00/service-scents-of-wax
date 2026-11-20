type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  children?: CategoryNode[];
};

type CategoryWithLevel = CategoryNode & {
  level: number;
  children: CategoryWithLevel[];
};

export const addLevel = (
  categories: CategoryNode[],
  level = 0,
): CategoryWithLevel[] => {
  return categories.map((category) => ({
    ...category,
    level,
    children: addLevel(category.children || [], level + 1),
  }));
};

export const buildCategoryTree = (
  categories: CategoryNode[],
): CategoryWithLevel[] => {
  return addLevel(categories);
};
