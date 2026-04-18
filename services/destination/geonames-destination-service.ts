/**
 * GeoNames destination search (free tier).
 *
 * Requires a free account at https://geonames.org — after creating one, enable
 * the "Free Web Services" option in your account settings, then set
 * EXPO_PUBLIC_GEONAMES_USERNAME in .env.
 *
 * Feature classes searched:
 *   P — populated places (cities, towns, villages)
 *   A — administrative divisions (countries, states, regions)
 *
 * Street-level results (class S, R, etc.) are excluded by design.
 */

import { appConfig } from '@/constants/config';
import type { DestinationResult, DestinationSearchService, DestinationType } from './destination-types';

type GeonamesItem = {
  geonameId: number;
  name: string;
  countryName?: string;
  adminName1?: string;
  fcl: string;
  fcode: string;
  // GeoNames returns these as strings in MEDIUM style
  lat?: string;
  lng?: string;
};

type GeonamesResponse = {
  geonames?: GeonamesItem[];
  status?: { message: string; value: number };
};

function buildLabel(item: GeonamesItem): string {
  const parts: string[] = [item.name];
  // Avoid repeating a part that already appears earlier (e.g. "Vienna, Vienna, Austria")
  if (item.adminName1 && item.adminName1 !== item.name) {
    parts.push(item.adminName1);
  }
  if (item.countryName && item.countryName !== item.name && item.countryName !== item.adminName1) {
    parts.push(item.countryName);
  }
  return parts.join(', ');
}

const COUNTRY_FCODES = new Set(['PCLI', 'PCLD', 'PCLF', 'PCLH', 'PCLIX', 'PCLX']);

function resolveType(fcl: string, fcode: string): DestinationType {
  if (COUNTRY_FCODES.has(fcode)) return 'country';
  if (fcl === 'A') return 'region';
  if (fcl === 'P') return 'city';
  return 'place';
}

export const geonamesDestinationService: DestinationSearchService = {
  async search(query: string): Promise<DestinationResult[]> {
    const params = [
      `q=${encodeURIComponent(query)}`,
      'maxRows=8',
      'featureClass=P',
      'featureClass=A',
      'orderby=relevance',
      'style=MEDIUM',
      `username=${encodeURIComponent(appConfig.geonamesUsername)}`,
    ].join('&');

    const response = await fetch(`https://secure.geonames.org/searchJSON?${params}`);

    if (!response.ok) {
      throw new Error(`GeoNames request failed (${response.status})`);
    }

    const data = (await response.json()) as GeonamesResponse;

    if (data.status) {
      // GeoNames returns HTTP 200 even for auth/quota errors; surface them.
      throw new Error(data.status.message);
    }

    return (data.geonames ?? []).map((item) => ({
      geonameId: item.geonameId,
      label: buildLabel(item),
      city: item.fcl === 'P' ? item.name : null,
      region: item.adminName1 ?? null,
      country: item.countryName ?? '',
      type: resolveType(item.fcl, item.fcode),
      lat: item.lat != null ? parseFloat(item.lat) : undefined,
      lng: item.lng != null ? parseFloat(item.lng) : undefined,
    }));
  },
};
