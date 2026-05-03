export type YesNo = 'Yes' | 'No';
export type YesNoUnsure = 'Yes' | 'No' | 'Unsure';
export type TravelParty = 'Solo' | 'Couple' | 'Family' | 'Group';
export type ShoeCount = '1' | '2' | '3' | '4+';
export type StyleVibe = 'Relaxed' | 'Smart Cas' | 'Polished' | 'Mix';

export type TripPurpose =
  | 'Business'
  | 'Conference'
  | 'Leisure'
  | 'Wedding / Event'
  | 'Beach / Resort'
  | 'Adventure';

export type PlannerTab = 'new' | 'saved';

export const PURPOSES: TripPurpose[] = [
  'Business',
  'Conference',
  'Leisure',
  'Wedding / Event',
  'Beach / Resort',
  'Adventure',
];
