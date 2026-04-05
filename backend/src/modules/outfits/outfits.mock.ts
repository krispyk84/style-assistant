import type { GenerateOutfitsRequest, OutfitPieceDto, OutfitResponse, OutfitTierSlug, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

type OutfitCategory = NonNullable<OutfitPieceDto['metadata']>['category'];
type OutfitFormality = NonNullable<OutfitPieceDto['metadata']>['formality'];

function p(display_name: string, category: OutfitCategory, color: string, formality: OutfitFormality, material?: string): OutfitPieceDto {
  return { display_name, metadata: { category, color, formality, ...(material ? { material } : {}) } };
}

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
      keyPieces: [
        p('Fine-gauge black merino crewneck', 'Knitwear', 'Black', 'Refined Casual', 'Merino wool'),
        p('Charcoal pleated wool trouser', 'Trousers', 'Charcoal', 'Formal', 'Wool'),
        p('Dark navy topcoat', 'Coat', 'Navy', 'Formal', 'Wool'),
      ],
      shoes: [p('Black calfskin loafer', 'Loafers', 'Black', 'Formal', 'Leather')],
      accessories: [
        p('Silver watch', 'Watch', 'Silver', 'Formal'),
        p('Black grained leather belt', 'Belt', 'Black', 'Formal', 'Leather'),
      ],
      fitNotes: ['Keep the jacket trim through the shoulder', 'Trouser break should stay minimal', 'Use a close body knit to avoid bulk'],
      whyItWorks: 'The sharper trouser and dark leather accessories frame the anchor piece as intentional rather than utilitarian.',
      stylingDirection: 'Quiet luxury business dressing with soft structure.',
      detailNotes: ['Lean on tonal layering.', 'Use cleaner footwear than a casual derby.'],
    },
    {
      title: 'Modern office authority',
      keyPieces: [
        p('Cream long-sleeve polo', 'Polo', 'Cream', 'Refined Casual', 'Cotton'),
        p('Deep navy drawstring wool trouser', 'Trousers', 'Navy', 'Formal', 'Wool'),
        p('Black unstructured blazer', 'Blazer', 'Black', 'Refined Casual'),
      ],
      shoes: [p('Dark espresso derby shoe', 'Shoes', 'Brown', 'Formal', 'Leather')],
      accessories: [
        p('Slim leather folio', 'Bag', 'Brown', 'Refined Casual', 'Leather'),
        p('Matte steel cuff watch', 'Watch', 'Steel', 'Refined Casual'),
      ],
      fitNotes: ['Keep the polo collar clean', 'Favor a higher rise', 'Use a slimmer derby last'],
      whyItWorks: 'This version makes the anchor item feel more directional while staying contemporary.',
      stylingDirection: 'Executive but relaxed.',
      detailNotes: ['The cream polo brightens the face.', 'A softer blazer keeps it modern.'],
    },
  ],
  'smart-casual': [
    {
      title: 'Dinner-ready smart casual',
      keyPieces: [
        p('Stone textured tee', 'T-Shirt', 'Stone', 'Smart Casual', 'Cotton'),
        p('Chocolate pleated trouser', 'Trousers', 'Brown', 'Smart Casual', 'Wool blend'),
        p('Fine-knit zip cardigan', 'Cardigan', 'Stone', 'Smart Casual', 'Cotton blend'),
      ],
      shoes: [p('Dark brown penny loafer', 'Loafers', 'Brown', 'Smart Casual', 'Leather')],
      accessories: [
        p('Suede belt', 'Belt', 'Brown', 'Smart Casual', 'Suede'),
        p('Minimal gold signet ring', 'Watch', 'Gold', 'Smart Casual'),
      ],
      fitNotes: ['Keep the tee fitted through the sleeve', 'Let the trouser drape', 'Cardigan can stay open'],
      whyItWorks: 'The earth-tone palette complements the anchor item without feeling too styled.',
      stylingDirection: 'Editorial smart casual with warm neutrals.',
      detailNotes: ['Texture does the work here.', 'The loafer keeps the finish elevated.'],
    },
    {
      title: 'Gallery night balance',
      keyPieces: [
        p('Washed black polo knit', 'Knitwear', 'Black', 'Smart Casual'),
        p('Ecru straight trouser', 'Trousers', 'Cream', 'Smart Casual'),
        p('Soft charcoal overshirt', 'Overshirt', 'Charcoal', 'Smart Casual', 'Cotton'),
      ],
      shoes: [p('Black leather moc-toe loafer', 'Loafers', 'Black', 'Smart Casual', 'Leather')],
      accessories: [
        p('Slim silver chain necklace', 'Watch', 'Silver', 'Smart Casual'),
        p('Soft leather tote', 'Bag', 'Brown', 'Smart Casual', 'Leather'),
      ],
      fitNotes: ['Use fuller trousers', 'Keep the overshirt relaxed', 'Show intentional ankle or sock'],
      whyItWorks: 'The darker knit and lighter trouser sharpen the silhouette while staying versatile.',
      stylingDirection: 'Urban smart casual with stronger silhouette play.',
      detailNotes: ['Feels cooler and more fashion-aware.', 'A tote keeps it city-ready.'],
    },
  ],
  casual: [
    {
      title: 'Refined weekend uniform',
      keyPieces: [
        p('Heather grey heavyweight tee', 'T-Shirt', 'Grey', 'Casual', 'Cotton'),
        p('Ecru relaxed denim', 'Denim', 'Cream', 'Casual', 'Denim'),
      ],
      shoes: [p('White leather low-top sneaker', 'Sneakers', 'White', 'Casual', 'Leather')],
      accessories: [
        p('Natural canvas tote', 'Bag', 'Stone', 'Casual', 'Canvas'),
        p('Simple black sunglasses', 'Sunglasses', 'Black', 'Casual'),
      ],
      fitNotes: ['Let the denim sit straight', 'The tee should skim the torso', 'Keep the sneaker clean'],
      whyItWorks: 'This gives the anchor item a repeatable everyday formula.',
      stylingDirection: 'Clean off-duty dressing with premium basics.',
      detailNotes: ['The ecru denim brightens the look.', 'Keep accessories minimal.'],
    },
    {
      title: 'Travel-day casual',
      keyPieces: [
        p('Washed oatmeal hoodie', 'Hoodie', 'Stone', 'Casual', 'Cotton fleece'),
        p('Soft black drawstring sweatpants', 'Sweatpants', 'Black', 'Casual', 'Cotton'),
        p('Ribbed white tee', 'T-Shirt', 'White', 'Casual', 'Cotton'),
      ],
      shoes: [p('Taupe running-inspired sneaker', 'Sneakers', 'Stone', 'Casual')],
      accessories: [
        p('Slim crossbody pouch', 'Bag', 'Black', 'Casual'),
        p('Washed cotton baseball cap', 'Scarf', 'Grey', 'Casual', 'Cotton'),
      ],
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
