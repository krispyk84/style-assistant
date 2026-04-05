import { anchorItem } from '@/lib/mock-data';
import type { CreateLookInput, LookRecommendation, LookRequestResponse, LookTierDefinition, LookTierSlug, OutfitPiece } from '@/types/look-request';

function p(display_name: string): OutfitPiece {
  return { display_name, metadata: null };
}

export const lookTierDefinitions: LookTierDefinition[] = [
  {
    slug: 'business',
    label: 'Business',
    shortDescription: 'Sharper, office-ready styling built around polish and structure.',
    positioning: 'For meetings, client dinners, and any setting where authority matters.',
    bestFor: ['Office days', 'Client presentations', 'Business travel dinners'],
    palette: ['Navy', 'Charcoal', 'Off-white', 'Black'],
  },
  {
    slug: 'smart-casual',
    label: 'Smart Casual',
    shortDescription: 'Relaxed tailoring with enough intent to feel elevated.',
    positioning: 'Balances refinement and ease for social settings and modern work routines.',
    bestFor: ['Creative office days', 'Dinner dates', 'Weekend city plans'],
    palette: ['Olive', 'Stone', 'Cream', 'Espresso'],
  },
  {
    slug: 'casual',
    label: 'Casual',
    shortDescription: 'Clean off-duty styling that still feels considered.',
    positioning: 'Keeps the anchor item central while loosening the silhouette and finish.',
    bestFor: ['Coffee runs', 'Travel days', 'Laid-back weekends'],
    palette: ['Faded blue', 'Ecru', 'Heather grey', 'White'],
  },
];

const lookRecommendationVariants: Record<LookTierSlug, Omit<LookRecommendation, 'tier' | 'anchorItem'>[]> = {
  business: [
    {
      title: 'Structured client dinner look',
      keyPieces: [p('Fine-gauge black merino crewneck'), p('Charcoal pleated wool trouser'), p('Dark navy topcoat')],
      shoes: [p('Black calfskin loafer')],
      accessories: [p('Silver watch'), p('Black grained leather belt')],
      fitNotes: ['Keep the jacket trim through the shoulder', 'Trouser break should stay minimal', 'Use a close body knit to avoid bulk under the anchor layer'],
      whyItWorks: 'The sharper trouser and dark leather accessories frame the anchor item as intentional tailoring instead of utility outerwear.',
      stylingDirection: 'Quiet luxury business dressing with soft structure and controlled contrast.',
      detailNotes: ['Lean on tonal layering so the anchor item stays premium.', 'A clean loafer keeps the look modern without becoming formal suiting.'],
    },
    {
      title: 'Modern office authority',
      keyPieces: [p('Cream long-sleeve polo'), p('Deep navy drawstring wool trouser'), p('Black unstructured blazer')],
      shoes: [p('Dark espresso derby')],
      accessories: [p('Leather folio'), p('Matte steel cuff')],
      fitNotes: ['Keep the polo collar sitting clean under the jacket', 'Trouser rise should sit high enough to elongate the leg', 'Derbies should have a slimmer last'],
      whyItWorks: 'This variant gives the anchor item a more directional business context while keeping the outfit approachable and contemporary.',
      stylingDirection: 'Executive but relaxed, closer to modern tailoring than classic corporate.',
      detailNotes: ['The cream polo brightens the face and softens the darker layers.', 'A softer blazer stops the outfit from feeling overbuilt.'],
    },
  ],
  'smart-casual': [
    {
      title: 'Dinner-ready smart casual',
      keyPieces: [p('Stone textured tee'), p('Chocolate pleated trouser'), p('Fine-knit zip cardigan')],
      shoes: [p('Dark brown penny loafer')],
      accessories: [p('Suede belt'), p('Minimal signet ring')],
      fitNotes: ['Keep the tee fitted through the sleeve', 'Trouser drape should feel fluid, not skinny', 'Cardigan can stay open for more vertical line'],
      whyItWorks: 'The earth-tone palette complements the anchor item and creates a confident smart-casual look without relying on obvious statement pieces.',
      stylingDirection: 'Editorial smart casual with warm neutrals and refined texture.',
      detailNotes: ['The cardigan gives depth without competing with the anchor item.', 'The loafer keeps the overall finish elevated.'],
    },
    {
      title: 'Gallery night balance',
      keyPieces: [p('Washed black polo knit'), p('Ecru straight trouser'), p('Soft charcoal overshirt')],
      shoes: [p('Black leather moc-toe loafer')],
      accessories: [p('Slim chain'), p('Soft leather tote')],
      fitNotes: ['Use slightly fuller trousers for shape', 'Let the overshirt sit relaxed over the polo', 'Expose a small amount of ankle or sock intentionally'],
      whyItWorks: 'The darker knit and lighter trouser sharpen the silhouette while still letting the anchor item feel versatile and lived-in.',
      stylingDirection: 'Urban smart casual with subtle contrast and stronger silhouette play.',
      detailNotes: ['This version feels cooler and more fashion-aware.', 'A tote keeps the look city-ready without reading corporate.'],
    },
  ],
  casual: [
    {
      title: 'Refined weekend uniform',
      keyPieces: [p('Heather grey heavyweight tee'), p('Ecru relaxed denim')],
      shoes: [p('White leather sneaker')],
      accessories: [p('Canvas tote'), p('Simple black sunglasses')],
      fitNotes: ['Let the denim sit straight, not stacked', 'The tee should skim the torso', 'Sneakers need to stay clean and minimal'],
      whyItWorks: 'The casual basics ground the anchor item and make it feel like part of a repeatable everyday formula.',
      stylingDirection: 'Clean off-duty dressing with premium basics and easy proportions.',
      detailNotes: ['The ecru denim adds brightness without feeling loud.', 'Minimal accessories keep it effortless.'],
    },
    {
      title: 'Travel-day casual',
      keyPieces: [p('Washed oatmeal hoodie'), p('Soft black drawstring pant'), p('Ribbed white tee')],
      shoes: [p('Taupe running-inspired sneaker')],
      accessories: [p('Crossbody pouch'), p('Baseball cap')],
      fitNotes: ['Keep the hoodie slightly cropped to preserve shape', 'The pant should taper softly, not hug', 'Layer the tee visibly under the hoodie'],
      whyItWorks: 'This swaps polish for comfort but still protects the visual structure of the outfit, making the anchor item feel easy instead of sloppy.',
      stylingDirection: 'Comfort-driven casual with enough restraint to still feel styled.',
      detailNotes: ['The soft black pant keeps the outfit from tipping athletic.', 'Use a muted sneaker instead of a loud performance shoe.'],
    },
  ],
};

const sampleRequests: Record<string, CreateLookInput> = {
  'request-001': {
    anchorItems: [
      {
        id: 'anchor-request-001',
        description: anchorItem.name,
        image: null,
        uploadedImage: null,
      },
    ],
    anchorItemDescription: anchorItem.name,
    anchorImage: null,
    uploadedAnchorImage: null,
    photoPending: true,
    selectedTiers: ['business', 'smart-casual', 'casual'],
  },
  'request-002': {
    anchorItems: [
      {
        id: 'anchor-request-002',
        description: 'Navy knit overshirt',
        image: null,
        uploadedImage: null,
      },
    ],
    anchorItemDescription: 'Navy knit overshirt',
    anchorImage: null,
    uploadedAnchorImage: null,
    photoPending: false,
    selectedTiers: ['business', 'smart-casual', 'casual'],
  },
  'request-003': {
    anchorItems: [
      {
        id: 'anchor-request-003',
        description: 'Black zip cardigan',
        image: null,
        uploadedImage: null,
      },
    ],
    anchorItemDescription: 'Black zip cardigan',
    anchorImage: null,
    uploadedAnchorImage: null,
    photoPending: true,
    selectedTiers: ['business', 'smart-casual', 'casual'],
  },
};

export function getLookTierDefinition(tier: string) {
  return lookTierDefinitions.find((definition) => definition.slug === tier);
}

export function getLookVariantCount(tier: LookTierSlug) {
  return lookRecommendationVariants[tier].length;
}

export function createMockRequestId() {
  return `request-${Date.now()}`;
}

export function buildMockLookResponse(
  input: CreateLookInput,
  requestId = createMockRequestId(),
  variantMap?: Partial<Record<LookTierSlug, number>>
): LookRequestResponse {
  const recommendations = input.selectedTiers.map((tier) => {
    const variants = lookRecommendationVariants[tier];
    const variantIndex = variantMap?.[tier] ?? 0;
    const variant = variants[((variantIndex % variants.length) + variants.length) % variants.length];

    return {
      tier,
      anchorItem: input.anchorItemDescription,
      ...variant,
    };
  });

  return {
    requestId,
    status: 'completed',
    generatedAt: new Date().toISOString(),
    input,
    recommendations,
  };
}

export function getSampleLookResponse(requestId: string) {
  const sampleInput = sampleRequests[requestId];

  if (!sampleInput) {
    return undefined;
  }

  return buildMockLookResponse(sampleInput, requestId);
}
