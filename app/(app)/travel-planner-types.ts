export type YesNo = 'Yes' | 'No';
export type YesNoUnsure = 'Yes' | 'No' | 'Unsure';
export type TravelParty = 'Solo' | 'Couple' | 'Family' | 'Group';
export type ShoeCount = '1' | '2' | '3' | '4+';
export type JacketCount = '0' | '1' | '2' | '3';
export type StyleVibe = 'Relaxed' | 'Smart Cas' | 'Polished' | 'Mix';

// A loose alias, not a strict union: "+ Add something else" lets the user
// append an arbitrary custom activity, and `purposes` is stored as an
// unrestricted string[] end-to-end (frontend TripDraft, TripPlan Zod schema,
// SavedTrip's Json column) — there was never a real enum to widen.
export type TripPurpose = string;

/** Suggested activity chips for "What will you be doing?" — wardrobe-relevant, not travel-booking categories. */
export const PURPOSES: TripPurpose[] = [
  'Sightseeing',
  'Casual days',
  'Nice dinners',
  'Business',
  'Conference',
  'Wedding / Event',
  'Beach / Resort',
  'Outdoors / Adventure',
  'Nightlife',
];

// Old trips/drafts may still carry these pre-redesign values — map them to a
// current-list label for DISPLAY only. The stored string itself is never
// rewritten, so old saved trips keep loading exactly as before.
const LEGACY_PURPOSE_LABELS: Record<string, string> = {
  Leisure: 'Casual days',
  Adventure: 'Outdoors / Adventure',
};

export function displayPurposeLabel(value: string): string {
  return LEGACY_PURPOSE_LABELS[value] ?? value;
}
