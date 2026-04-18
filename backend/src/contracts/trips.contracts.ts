export type TripOutfitDayDto = {
  id: string;
  tripId: string;
  dayIndex: number;
  date: string;           // YYYY-MM-DD
  title: string;          // e.g. "Arrival in Kyoto"
  dayType: string;        // travel_day | sightseeing | business | dinner_out | beach_pool | adventure | wedding_event | relaxed | conference
  rationale: string;      // Why this outfit for this day
  pieces: string[];       // Main garment pieces (top, bottom, layer)
  shoes: string;          // Shoes description
  bag: string | null;
  accessories: string[];
  contextTags: string[];  // e.g. ["layered", "beach-ready", "wrinkle-resistant"]
};

export type GenerateTripOutfitsRequest = {
  tripId: string;
  profileId?: string;
  destination: string;       // human-readable label
  country: string;
  departureDate: string;     // YYYY-MM-DD
  returnDate: string;        // YYYY-MM-DD
  travelParty: string;       // Solo | Couple | Family | Group
  purposes: string[];        // Business | Conference | Leisure | Wedding / Event | Beach / Resort | Adventure
  climateLabel: string;      // e.g. "Warm and dry, cooler evenings"
  avgHighC?: number;
  avgLowC?: number;
  tempBand?: string;         // hot | warm | mild | cool | cold
  precipChar?: string;       // dry | variable | wet
  packingTag?: string;       // hot_dry | warm_wet | mild_dry | cool | cold | etc.
  dressSeason?: string;      // summer | spring_autumn | winter | tropical
  activities?: string;       // free text
  dressCode?: string;        // free text
  styleVibe: string;         // Relaxed | Smart Cas | Polished | Mix
  willSwim: boolean;
  fancyNights: boolean;
  workoutClothes: boolean;
  laundryAccess: 'Yes' | 'No' | 'Unsure';
  shoesCount: string;        // 1 | 2 | 3 | 4+
  carryOnOnly: boolean;
  specialNeeds?: string;
};

export type GenerateTripOutfitsResponse = {
  tripId: string;
  days: TripOutfitDayDto[];
};

export type RegenerateTripDayRequest = {
  tripId: string;
  dayIndex: number;
  date: string;
  dayType: string;
  destination: string;
  country: string;
  climateLabel: string;
  activities?: string;
  dressCode?: string;
  styleVibe: string;
  purposes: string[];
  previousPieces: string[];
  previousShoes?: string;
  profileId?: string;
};
