export type DestinationType = 'city' | 'region' | 'country' | 'place';

export type DestinationResult = {
  id: string;
  /** Human-readable: "Cabo San Lucas, Baja California Sur, Mexico" */
  label: string;
  city: string | null;
  /** State / province / admin-1 region */
  region: string | null;
  country: string;
  type: DestinationType;
  /** Decimal latitude */
  lat?: number;
  /** Decimal longitude */
  lng?: number;
  /** City/place population — used for popularity ranking, when the provider supplies it */
  population?: number;
};

export interface DestinationSearchService {
  search(query: string): Promise<DestinationResult[]>;
}
