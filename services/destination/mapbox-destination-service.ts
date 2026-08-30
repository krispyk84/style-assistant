/**
 * Mapbox Geocoding v6 destination search.
 *
 * Replaces the GeoNames service, which had never had a real account
 * configured (silently falling back to GeoNames' shared public "demo"
 * account, which ran out of its shared daily quota). Mapbox's free tier
 * (100k requests/month) is generous enough that this app's handful of users
 * will never come close, and isn't a quota shared with strangers worldwide.
 *
 * Requires a free account at https://mapbox.com — grab the default public
 * token from the account dashboard's "Access tokens" page, then set
 * EXPO_PUBLIC_MAPBOX_TOKEN in .env.
 */

import { appConfig } from '@/constants/config';
import type { DestinationResult, DestinationSearchService, DestinationType } from './destination-types';
import { rankDestinationResults } from './destination-ranking';

type MapboxContextEntry = { name?: string };

type MapboxFeature = {
  properties: {
    mapbox_id: string;
    feature_type: string;
    name: string;
    full_address?: string;
    place_formatted?: string;
    context?: {
      region?: MapboxContextEntry;
      country?: MapboxContextEntry;
    };
    coordinates?: { longitude: number; latitude: number };
  };
  geometry?: { coordinates: [number, number] };
};

type MapboxResponse = {
  features?: MapboxFeature[];
  message?: string;
};

function resolveType(featureType: string): DestinationType {
  if (featureType === 'country') return 'country';
  if (featureType === 'region') return 'region';
  if (featureType === 'place') return 'city';
  return 'place';
}

function buildLabel(feature: MapboxFeature): string {
  if (feature.properties.full_address) return feature.properties.full_address;
  const parts = [feature.properties.name];
  if (feature.properties.place_formatted) parts.push(feature.properties.place_formatted);
  return parts.join(', ');
}

export const mapboxDestinationService: DestinationSearchService = {
  async search(query: string): Promise<DestinationResult[]> {
    const params = [
      `q=${encodeURIComponent(query)}`,
      'types=place,region,country',
      'autocomplete=true',
      'language=en',
      'limit=10',
      `access_token=${encodeURIComponent(appConfig.mapboxToken)}`,
    ].join('&');

    const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as MapboxResponse | null;
      throw new Error(body?.message ?? `Mapbox request failed (${response.status})`);
    }

    const data = (await response.json()) as MapboxResponse;

    const results: DestinationResult[] = (data.features ?? []).map((feature) => {
      const type = resolveType(feature.properties.feature_type);
      const lng = feature.properties.coordinates?.longitude ?? feature.geometry?.coordinates[0];
      const lat = feature.properties.coordinates?.latitude ?? feature.geometry?.coordinates[1];

      return {
        id: feature.properties.mapbox_id,
        label: buildLabel(feature),
        city: type === 'city' ? feature.properties.name : null,
        region: feature.properties.context?.region?.name ?? null,
        country: feature.properties.context?.country?.name ?? (type === 'country' ? feature.properties.name : ''),
        type,
        lat,
        lng,
      };
    });

    // Re-rank by match quality + type — trim to display limit.
    return rankDestinationResults(query, results).slice(0, 8);
  },
};
