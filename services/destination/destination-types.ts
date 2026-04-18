export type DestinationType = 'city' | 'region' | 'country' | 'place';

export type DestinationResult = {
  geonameId: number;
  /** Human-readable: "Cabo San Lucas, Baja California Sur, Mexico" */
  label: string;
  city: string | null;
  /** State / province / admin-1 region */
  region: string | null;
  country: string;
  type: DestinationType;
  /** Decimal latitude — present for all GeoNames results */
  lat?: number;
  /** Decimal longitude — present for all GeoNames results */
  lng?: number;
};

export interface DestinationSearchService {
  search(query: string): Promise<DestinationResult[]>;
}
