import type { OutfitPieceDto, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

/**
 * Prompts for fal.ai flux-lora sketch generation.
 *
 * Format matches the successful local LoRA test:
 *   VESTURE_OUTFIT, [tier] outfit on headless mannequin, [anchor first], [key pieces],
 *   [shoes], [worn accessories] visible, [beside accessories] beside,
 *   warm watercolor wash background
 *
 * Key rules:
 * - Anchor uses the clean raw anchorItemDescription — NOT recommendation.anchorItem
 *   which is an AI narrative ("...as the hero piece, worn open over...") that adds noise
 * - Accessories are split: worn-on-body (belt, watch, tie) vs beside-mannequin (bag, glasses)
 * - Piece names stripped of trailing "with X" / "— X" clauses, capped at 6 words
 * - Fit adjectives (tailored, slim-fit, wide-leg, oversized) appear early and are preserved
 * - No instruction-style negatives — negative_prompt in fal-client handles suppression
 */

/**
 * Accessories that are worn ON the body and should be visible in the sketch.
 * When present these go into "[X] visible" to explicitly tell the model to render them.
 */
const WORN_ACCESSORY_KEYWORDS = [
  'belt', 'watch', 'tie', 'scarf', 'pocket square', 'bracelet', 'necklace',
  'ring', 'suspenders', 'cufflinks',
];

/**
 * Accessories that are placed BESIDE the mannequin (not on-body).
 */
const BESIDE_ACCESSORY_KEYWORDS = [
  'bag', 'tote', 'backpack', 'briefcase', 'sunglasses', 'glasses', 'hat',
  'cap', 'umbrella', 'gloves',
];

function classifyAccessory(piece: OutfitPieceDto): 'worn' | 'beside' {
  const cat = (piece.metadata?.category ?? '').toLowerCase();
  const name = piece.display_name.toLowerCase();
  const haystack = `${cat} ${name}`;

  if (WORN_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'worn';
  if (BESIDE_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'beside';
  return 'beside'; // default
}

/**
 * Garment families with their defining structural constraints.
 * These are injected after the anchor token to prevent tier-label drift
 * (e.g. "business" causing Flux to substitute a blazer for a bomber jacket).
 */
const GARMENT_SILHOUETTE_CONSTRAINTS: Array<{
  keywords: string[];
  constraint: string;
}> = [
  {
    keywords: ['bomber', 'flight jacket', 'ma-1', 'ma1'],
    constraint: 'ribbed band collar, front zip closure, no lapels, no buttons, elasticated hem and cuffs',
  },
  {
    keywords: ['field jacket', 'utility jacket', 'chore coat', 'chore jacket', 'work jacket'],
    constraint: 'spread collar with button placket, patch chest pockets, button-front closure',
  },
  {
    keywords: ['blazer', 'sport coat', 'sport jacket', 'suit jacket'],
    constraint: 'notch lapels, button-front, structured shoulders, welt pockets',
  },
  {
    keywords: ['overshirt', 'shirt jacket', 'shacket'],
    constraint: 'shirt collar, button-front, chest pockets, relaxed boxy cut',
  },
  {
    keywords: ['denim jacket', 'jean jacket', 'trucker jacket'],
    constraint: 'point collar, button-front, chest pockets, denim fabric',
  },
  {
    keywords: ['puffer', 'puffa', 'down jacket', 'quilted jacket'],
    constraint: 'quilted panels, stand collar or hood, zip-front closure, bulky silhouette',
  },
  {
    keywords: ['leather jacket', 'moto jacket', 'biker jacket'],
    constraint: 'asymmetric zip closure, lapels or band collar, moto hardware',
  },
  {
    keywords: ['trench coat', 'trench'],
    constraint: 'double-breasted, notch lapels, belted waist, epaulettes',
  },
  {
    keywords: ['peacoat', 'pea coat'],
    constraint: 'double-breasted, wide notch lapels, structured wool',
  },
  {
    keywords: ['overcoat', 'topcoat', 'wool coat', 'camel coat'],
    constraint: 'single or double-breasted, long hem below knee, structured lapels',
  },
  {
    keywords: ['cardigan'],
    constraint: 'open front, knit fabric, no collar, button or open placket',
  },
  {
    keywords: ['hoodie', 'hooded sweatshirt'],
    constraint: 'attached hood, kangaroo pocket or zip-front, no collar',
  },
  {
    keywords: ['crewneck', 'crew-neck sweatshirt', 'crew neck sweater'],
    constraint: 'round neckline, no collar, no hood, ribbed cuffs and hem',
  },
  {
    keywords: ['turtleneck', 'roll-neck', 'rollneck'],
    constraint: 'high folded neck tube, no collar, close-fitting neckline',
  },
];

/**
 * Extracts structural constraints for the anchor garment type from its description.
 * Returns a constraint string or null if no matching garment family is found.
 */
function buildAnchorSilhouetteConstraint(anchorDescription: string): string | null {
  const lower = anchorDescription.toLowerCase();
  for (const { keywords, constraint } of GARMENT_SILHOUETTE_CONSTRAINTS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return constraint;
    }
  }
  return null;
}

/**
 * Trim verbose AI piece names to the core visual description.
 * Strips trailing "with X" / "— X" / "featuring X" clauses (fabric specifics
 * that add noise), then caps at 6 words. Fit/silhouette adjectives
 * (tailored, slim-fit, wide-leg, oversized) appear early and survive.
 */
function shortenPieceName(name: string): string {
  const stripped = name.split(/\s+with\s+|\s+—\s+|\s+featuring\s+/i)[0] ?? name;
  const words = stripped.trim().split(/\s+/);
  return words.slice(0, 6).join(' ');
}

function pieceLabel(piece: OutfitPieceDto): string {
  return shortenPieceName(piece.display_name);
}

export function buildClosetItemSketchPrompt(input: { itemDescription: string; gender?: string | null }) {
  return `${shortenPieceName(input.itemDescription)}, single garment, warm parchment background`;
}

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  recommendation: TierRecommendationDto;
  gender?: string | null;
}) {
  const tier = input.tierLabel.toLowerCase();

  // Anchor: use the clean raw input — NOT recommendation.anchorItem which is an AI narrative.
  // anchorItemDescription is the original user-provided brief text ("Stone-taupe bomber jacket")
  // and is free of narrative noise. Position it first so it receives the strongest model attention.
  const anchor = shortenPieceName(input.anchorItemDescription);

  // Lock the anchor garment's silhouette so tier-label drift ("business") cannot cause
  // Flux to substitute a blazer/field jacket for the uploaded bomber (or other garment family).
  const anchorSilhouetteConstraint = buildAnchorSilhouetteConstraint(input.anchorItemDescription);

  // All key pieces (usually 2–3; cap at 4 to stay concise)
  const keyPieces = input.recommendation.keyPieces.slice(0, 4).map(pieceLabel);

  // Primary shoe
  const shoes = input.recommendation.shoes.slice(0, 1).map(pieceLabel);

  // Split accessories: worn on body vs placed beside mannequin
  const wornAccessories = input.recommendation.accessories
    .filter((p) => classifyAccessory(p) === 'worn')
    .slice(0, 3)
    .map(pieceLabel);

  const besideAccessories = input.recommendation.accessories
    .filter((p) => classifyAccessory(p) === 'beside')
    .slice(0, 2)
    .map(pieceLabel);

  // Build prompt parts — anchor token optionally followed by structural constraint
  const anchorToken = anchorSilhouetteConstraint
    ? `${anchor} (${anchorSilhouetteConstraint})`
    : anchor;
  const corePieces = [anchorToken, ...keyPieces, ...shoes].filter(Boolean).join(', ');

  // Worn accessories explicitly flagged as "visible" so the model renders them on the body
  const wornPart = wornAccessories.length > 0
    ? `${wornAccessories.join(', ')} visible`
    : null;

  // Beside accessories listed by name so the model places them next to the mannequin
  const besidePart = besideAccessories.length > 0
    ? `${besideAccessories.join(', ')} beside`
    : 'accessories beside';

  return [
    `${tier} outfit on headless mannequin`,
    corePieces,
    wornPart,
    besidePart,
    'warm watercolor wash background',
  ]
    .filter(Boolean)
    .join(', ');
}
