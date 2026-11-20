export type AddressLike = {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type OrderRequestItemSnapshot = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type FranchiseCandidate = {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

export type OrderAllocationRequestContext = {
  requestId: string;
};
