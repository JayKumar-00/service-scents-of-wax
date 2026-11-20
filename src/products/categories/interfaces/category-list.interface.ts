export interface IFlatCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  level: number;
}
