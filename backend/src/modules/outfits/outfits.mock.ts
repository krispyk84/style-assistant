import type { GenerateOutfitsRequest, OutfitResponse, OutfitTierSlug, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

const recommendationVariants: Record<
  OutfitTierSlug,
  Omit<
    TierRecommendationDto,
    'tier' | 'anchorItem' | 'variantIndex' | 'sketchStatus' | 'sketchImageUrl' | 'sketchStorageKey' | 'sketchMimeType'
  >[]
> = {
  business: [
    {
      title: 'Structured client dinner look',
      keyPieces: ['Fine-gauge black merino crewneck', 'Charcoal pleated wool trouser', 'Dark navy topcoat'],
      shoes: ['Black calfskin loafer'],
      accessories: ['Silver watch', 'Black grained leather belt'],
      fitNotes: ['Keep the jacket trim through the shoulder', 'Trouser break should stay minimal', 'Use a close body knit to avoid bulk'],
      whyItWorks: 'The sharper trouser and dark leather accessories frame the anchor piece as intentional rather than utilitarian.',
      stylingDirection: 'Quiet luxury business dressing with soft structure.',
      detailNotes: ['Lean on tonal layering.', 'Use cleaner footwear than a casual derby.'],
    },
    {
      title: 'Modern office authority',
      keyPieces: ['Cream long-sleeve polo', 'Deep navy drawstring wool trouser', 'Black unstructured blazer'],
      shoes: ['Dark espresso derby'],
      accessories: ['Leather folio', 'Matte steel cuff'],
      fitNotes: ['Keep the polo collar clean', 'Favor a higher rise', 'Use a slimmer derby last'],
      whyItWorks: 'This version makes the anchor item feel more directional while staying contemporary.',
      stylingDirection: 'Executive but relaxed.',
      detailNotes: ['The cream polo brightens the face.', 'A softer blazer keeps it modern.'],
    },
  ],
  'smart-casual': [
    {
      title: 'Dinner-ready smart casual',
      keyPieces: ['Stone textured tee', 'Chocolate pleated trouser', 'Fine-knit zip cardigan'],
      shoes: ['Dark brown penny loafer'],
      accessories: ['Suede belt', 'Minimal signet ring'],
      fitNotes: ['Keep the tee fitted through the sleeve', 'Let the trouser drape', 'Cardigan can stay open'],
      whyItWorks: 'The earth-tone palette complements the anchor item without feeling too styled.',
      stylingDirection: 'Editorial smart casual with warm neutrals.',
      detailNotes: ['Texture does the work here.', 'The loafer keeps the finish elevated.'],
    },
    {
      title: 'Gallery night balance',
      keyPieces: ['Washed black polo knit', 'Ecru straight trouser', 'Soft charcoal overshirt'],
      shoes: ['Black leather moc-toe loafer'],
      accessories: ['Slim chain', 'Soft leather tote'],
      fitNotes: ['Use fuller trousers', 'Keep the overshirt relaxed', 'Show intentional ankle or sock'],
      whyItWorks: 'The darker knit and lighter trouser sharpen the silhouette while staying versatile.',
      stylingDirection: 'Urban smart casual with stronger silhouette play.',
      detailNotes: ['Feels cooler and more fashion-aware.', 'A tote keeps it city-ready.'],
    },
  ],
  casual: [
    {
      title: 'Refined weekend uniform',
      keyPieces: ['Heather grey heavyweight tee', 'Ecru relaxed denim', 'Navy cap'],
      shoes: ['White leather sneaker'],
      accessories: ['Canvas tote', 'Simple black sunglasses'],
      fitNotes: ['Let the denim sit straight', 'The tee should skim the torso', 'Keep the sneaker clean'],
      whyItWorks: 'This gives the anchor item a repeatable everyday formula.',
      stylingDirection: 'Clean off-duty dressing with premium basics.',
      detailNotes: ['The ecru denim brightens the look.', 'Keep accessories minimal.'],
    },
    {
      title: 'Travel-day casual',
      keyPieces: ['Washed oatmeal hoodie', 'Soft black drawstring pant', 'Ribbed white tee'],
      shoes: ['Taupe running-inspired sneaker'],
      accessories: ['Crossbody pouch', 'Baseball cap'],
      fitNotes: ['Keep the hoodie slightly cropped', 'The pant should taper softly', 'Show the tee underlayer'],
      whyItWorks: 'This version prioritizes comfort without losing shape.',
      stylingDirection: 'Comfort-driven casual with restraint.',
      detailNotes: ['The soft black pant prevents an athletic look.', 'Keep the sneaker muted.'],
    },
  ],
};

export function getVariantCount(tier: OutfitTierSlug) {
  return recommendationVariants[tier].length;
}

export function buildMockOutfitResponse(
  input: GenerateOutfitsRequest,
  variantMap: Partial<Record<OutfitTierSlug, number>> = {}
): OutfitResponse {
  const recommendations = input.selectedTiers.map((tier) => {
    const variants = recommendationVariants[tier];
    const variantIndex = variantMap[tier] ?? 0;
    const variant = variants[((variantIndex % variants.length) + variants.length) % variants.length];

    const recommendation: TierRecommendationDto = {
      tier,
      anchorItem: input.anchorItemDescription,
      sketchStatus: 'failed',
      sketchImageUrl: null,
      sketchStorageKey: null,
      sketchMimeType: null,
      variantIndex,
      ...variant,
    };

    return recommendation;
  });

  return {
    requestId: input.requestId,
    status: 'completed',
    provider: 'mock',
    generatedAt: new Date().toISOString(),
    input: {
      anchorItemDescription: input.anchorItemDescription,
      anchorImageId: input.anchorImageId ?? null,
      anchorImageUrl: input.anchorImageUrl ?? null,
      photoPending: input.photoPending,
      selectedTiers: input.selectedTiers,
    },
    recommendations,
  };
}
