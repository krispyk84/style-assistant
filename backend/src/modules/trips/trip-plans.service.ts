import { prisma } from '../../db/prisma.js';

export type CreateTripPlanParams = {
  supabaseUserId: string;
  destination: string;
  country: string;
  departureDate: string;
  returnDate: string;
  numDays: number;
  travelParty: string;
  purposes: string[];
  climateLabel: string;
  styleVibe: string;
  willSwim: boolean;
  fancyNights: boolean;
  workoutClothes: boolean;
  laundryAccess: string;
  shoesCount: string;
  carryOnOnly: boolean;
  activities?: string;
  dressCode?: string;
  specialNeeds?: string;
  anchorMode?: string;
};

export type UpsertTripAnchorParams = {
  slotId?: string;
  label: string;
  category: string;
  source: string;
  closetItemId?: string;
  uploadedImageId?: string;
  imageUrl?: string;
  rationale?: string;
  position?: number;
};

export const tripPlansService = {
  async createPlan(params: CreateTripPlanParams) {
    const db = prisma as any;
    return db.tripPlan.create({
      data: {
        supabaseUserId: params.supabaseUserId,
        destination:    params.destination,
        country:        params.country,
        departureDate:  params.departureDate,
        returnDate:     params.returnDate,
        numDays:        params.numDays,
        travelParty:    params.travelParty,
        purposes:       params.purposes,
        climateLabel:   params.climateLabel,
        styleVibe:      params.styleVibe,
        willSwim:       params.willSwim,
        fancyNights:    params.fancyNights,
        workoutClothes: params.workoutClothes,
        laundryAccess:  params.laundryAccess,
        shoesCount:     params.shoesCount,
        carryOnOnly:    params.carryOnOnly,
        activities:     params.activities ?? null,
        dressCode:      params.dressCode ?? null,
        specialNeeds:   params.specialNeeds ?? null,
        anchorMode:     params.anchorMode ?? null,
        status:         'draft',
      },
    });
  },

  async getPlan(planId: string, supabaseUserId: string) {
    const db = prisma as any;
    return db.tripPlan.findFirst({
      where: { id: planId, supabaseUserId },
      include: { anchors: { orderBy: { position: 'asc' } } },
    });
  },

  async setAnchors(
    planId: string,
    supabaseUserId: string,
    anchorMode: string,
    anchors: UpsertTripAnchorParams[],
  ) {
    const db = prisma as any;
    // Replace anchors atomically
    await db.$transaction([
      db.tripAnchor.deleteMany({ where: { tripPlanId: planId } }),
      db.tripAnchor.createMany({
        data: anchors.map((a, i) => ({
          tripPlanId:     planId,
          supabaseUserId,
          slotId:         a.slotId ?? null,
          label:          a.label,
          category:       a.category,
          source:         a.source,
          closetItemId:   a.closetItemId ?? null,
          uploadedImageId: a.uploadedImageId ?? null,
          imageUrl:       a.imageUrl ?? null,
          rationale:      a.rationale ?? null,
          position:       a.position ?? i,
        })),
      }),
      db.tripPlan.update({
        where: { id: planId },
        data:  { anchorMode, status: 'anchors_selected' },
      }),
    ]);
    return db.tripPlan.findUnique({
      where: { id: planId },
      include: { anchors: { orderBy: { position: 'asc' } } },
    });
  },

  async markGenerated(planId: string, tripId: string) {
    const db = prisma as any;
    return db.tripPlan.update({
      where: { id: planId },
      data:  { status: 'generated', tripId },
    });
  },
};
