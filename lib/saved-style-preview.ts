import type { SavedTripSummary } from '@/services/saved-trips';
import type { SavedOutfit } from '@/types/style';
import { formatTierLabel } from './outfit-utils';

type SavedStylePreviewBase = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  savedAt: string;
};

export type SavedOutfitPreview = SavedStylePreviewBase & {
  kind: 'outfit';
  source: SavedOutfit;
};

export type SavedTripPreview = SavedStylePreviewBase & {
  kind: 'trip';
  source: SavedTripSummary;
};

export type SavedStylePreview = SavedOutfitPreview | SavedTripPreview;

const COUNTRY_CODES: Record<string, string> = {
  'Afghanistan': 'AF',
  'Albania': 'AL',
  'Algeria': 'DZ',
  'Argentina': 'AR',
  'Australia': 'AU',
  'Austria': 'AT',
  'Belgium': 'BE',
  'Brazil': 'BR',
  'Canada': 'CA',
  'Chile': 'CL',
  'China': 'CN',
  'Colombia': 'CO',
  'Croatia': 'HR',
  'Czech Republic': 'CZ',
  'Denmark': 'DK',
  'Egypt': 'EG',
  'Finland': 'FI',
  'France': 'FR',
  'Germany': 'DE',
  'Greece': 'GR',
  'Hong Kong': 'HK',
  'Hungary': 'HU',
  'Iceland': 'IS',
  'India': 'IN',
  'Indonesia': 'ID',
  'Iran': 'IR',
  'Ireland': 'IE',
  'Israel': 'IL',
  'Italy': 'IT',
  'Japan': 'JP',
  'Jordan': 'JO',
  'Kenya': 'KE',
  'Malaysia': 'MY',
  'Maldives': 'MV',
  'Mexico': 'MX',
  'Morocco': 'MA',
  'Netherlands': 'NL',
  'New Zealand': 'NZ',
  'Nigeria': 'NG',
  'Norway': 'NO',
  'Peru': 'PE',
  'Philippines': 'PH',
  'Poland': 'PL',
  'Portugal': 'PT',
  'Romania': 'RO',
  'Russia': 'RU',
  'Saudi Arabia': 'SA',
  'Singapore': 'SG',
  'South Africa': 'ZA',
  'South Korea': 'KR',
  'Spain': 'ES',
  'Sweden': 'SE',
  'Switzerland': 'CH',
  'Taiwan': 'TW',
  'Thailand': 'TH',
  'Turkey': 'TR',
  'Ukraine': 'UA',
  'United Arab Emirates': 'AE',
  'United Kingdom': 'GB',
  'United States': 'US',
  'Vietnam': 'VN',
};

export function countryFlag(countryName: string): string {
  const code = COUNTRY_CODES[countryName];
  if (!code) return '';
  const regionalIndicatorA = 0x1F1E6 - 65;
  return String.fromCodePoint(
    regionalIndicatorA + code.charCodeAt(0),
    regionalIndicatorA + code.charCodeAt(1),
  );
}

export function formatSavedPreviewDate(savedAt: string): string {
  try {
    return new Date(savedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'recently';
  }
}

export function formatTripDateRange(departure: string, returnDate: string): string {
  try {
    const dep = new Date(`${departure}T00:00:00`);
    const ret = new Date(`${returnDate}T00:00:00`);
    const fmt = (date: Date) =>
      date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${fmt(dep)} \u2013 ${fmt(ret)}`;
  } catch {
    return `${departure} \u2013 ${returnDate}`;
  }
}

export function buildSavedOutfitPreview(outfit: SavedOutfit): SavedOutfitPreview {
  const anchorLabel = outfit.input.anchorItemDescription || outfit.recommendation.anchorItem;

  return {
    kind: 'outfit',
    id: outfit.id,
    title: outfit.recommendation.title,
    subtitle: anchorLabel || `${formatTierLabel(outfit.recommendation.tier)} tier`,
    imageUrl: outfit.recommendation.sketchImageUrl ?? null,
    savedAt: outfit.savedAt,
    source: outfit,
  };
}

export function buildSavedTripPreview(trip: SavedTripSummary): SavedTripPreview {
  const flag = countryFlag(trip.country);

  return {
    kind: 'trip',
    id: trip.id,
    title: `${flag ? `${flag} ` : ''}${trip.destination}`,
    subtitle: formatTripDateRange(trip.departureDate, trip.returnDate),
    imageUrl: null,
    savedAt: trip.savedAt,
    source: trip,
  };
}

export function getSavedPreviewImageUrls(previews: SavedStylePreview[]): string[] {
  return previews
    .map((preview) => preview.imageUrl)
    .filter((imageUrl): imageUrl is string => Boolean(imageUrl));
}

export function sortSavedStylePreviews(previews: SavedStylePreview[]): SavedStylePreview[] {
  return [...previews].sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}
