export interface GeoResult {
  lat: number;
  lng: number;
  source: string;
  address?: string;
}

export interface GeoProvider {
  geocode(address: string): Promise<GeoResult | null>;
}
