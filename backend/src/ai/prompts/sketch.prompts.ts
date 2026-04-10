import type { OutfitPieceDto, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

/**
 * Prompts for fal.ai flux-lora sketch generation.
 *
 * Anchor fidelity design:
 * - The anchor item is the PRIMARY visual constraint. Tier/style only affects the
 *   surrounding pieces, not the anchor itself.
 * - Anchor locking: the anchor is declared first after composition framing, with
 *   "preserve category and construction exactly" to block archetype substitution.
 * - Tier is positioned as a modifier ("outfit built around the anchor") rather than
 *   a declaration — prevents "Business attire" from activating a blazer/suit prior
 *   before the anchor description registers.
 * - Category-specific drift negatives (see ANCHOR_DRIFT_NEGATIVES) are injected into
 *   the negative prompt by the caller (tier-sketch.service.ts) so the model cannot
 *   substitute a tier-appropriate garment for the user's actual anchor item.
 *
 * Accessories are split: worn-on-body (belt, watch, tie) vs beside-mannequin (bag, glasses).
 * Piece names stripped of trailing "with X" / "— X" clauses, capped at 6 words.
 * Fit adjectives (tailored, slim-fit, wide-leg, oversized) appear early and are preserved.
 */

/**
 * Accessories that are worn ON the body and should be visible in the sketch.
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

/**
 * Per-category terms to add to the negative prompt so Flux cannot substitute a
 * tier-appropriate archetype for the user's actual anchor item.
 *
 * Keys are lowercase canonical item family names matching what `describeAnchorForSketch`
 * returns as `category`. Values are comma-separated suppression terms (no "no " prefix —
 * Flux negative prompts use noun/phrase form, not instruction form).
 */
const ANCHOR_DRIFT_NEGATIVES: Record<string, string> = {
  // Jackets — include structural lapel suppression so the model cannot draw
  // the defining feature of a blazer even when the category name alone isn't matched.
  'bomber jacket':    'blazer, suit jacket, field jacket, chore jacket, tailored jacket, lapels, notched lapels, peaked lapels, suit lapels',
  'overshirt':        'blazer, suit jacket, tailored jacket, lapels, notched lapels, peaked lapels, suit lapels, structured jacket collar',
  'blazer':           'overshirt, bomber jacket, unstructured jacket, track jacket',
  'chore jacket':     'blazer, suit jacket, field jacket, overshirt, lapels, notched lapels',
  'field jacket':     'blazer, lapels, notched lapels, peaked lapels, military-style blazer',
  'puffer jacket':    'quilted blazer, padded overshirt, down vest without sleeves',
  'puffer vest':      'puffer jacket with full sleeves, body warmer with sleeves',
  'denim jacket':     'blazer, lapels, notched lapels',
  'trench coat':      'overcoat, double-breasted peacoat',
  'peacoat':          'overcoat, trench coat, duffle coat',
  'leather jacket':   'blazer, lapels, notched lapels, peaked lapels, suit jacket',
  // Bags
  'tote bag':         'handbag with flap, clutch, briefcase, backpack',
  'backpack':         'tote bag, briefcase, duffel bag, messenger bag',
  'briefcase':        'messenger bag, backpack, tote bag',
  'messenger bag':    'briefcase, backpack, tote bag',
  // Footwear
  'derby shoe':       'loafer, oxford, monk strap',
  'oxford shoe':      'loafer, derby shoe',
  'loafer':           'derby shoe, moccasin, boat shoe, monk strap',
  'chelsea boot':     'ankle boot, desert boot, jodhpur boot',
  'desert boot':      'chelsea boot, chukka boot, ankle boot',
  'sneaker':          'dress shoe, loafer, boot',
  // Hats
  'bucket hat':       'baseball cap, panama hat, fisherman hat',
  'baseball cap':     'bucket hat, trucker cap, snapback',
  'beanie':           'beret, slouchy turban',
  'fedora':           'panama hat',
  'beret':            'beanie, bucket hat',
};

/**
 * Returns category-specific negative prompt terms for the given anchor item category.
 * Returns an empty string for categories not in the table (no additional suppression needed).
 */
export function getAnchorDriftNegatives(category: string): string {
  return ANCHOR_DRIFT_NEGATIVES[category.toLowerCase().trim()] ?? '';
}

/**
 * Trim verbose AI piece names to the core visual description.
 * Strips trailing "with X" / "— X" / "featuring X" clauses, then caps at 6 words.
 * Only used for supporting pieces (keyPieces, shoes, accessories) — NOT the anchor.
 */
function shortenPieceName(name: string): string {
  const stripped = name.split(/\s+with\s+|\s+—\s+|\s+featuring\s+/i)[0] ?? name;
  const words = stripped.trim().split(/\s+/);
  return words.slice(0, 6).join(' ');
}

function pieceLabel(piece: OutfitPieceDto): string {
  return shortenPieceName(piece.display_name);
}

function classifyAccessory(piece: OutfitPieceDto): 'worn' | 'beside' {
  const cat = (piece.metadata?.category ?? '').toLowerCase();
  const name = piece.display_name.toLowerCase();
  const haystack = `${cat} ${name}`;

  if (WORN_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'worn';
  if (BESIDE_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'beside';
  return 'beside';
}

export function buildClosetItemSketchPrompt(input: { itemDescription: string; gender?: string | null }) {
  return (
    `${input.itemDescription.trim()}, ` +
    `single garment, faithful stylized illustration, preserve all construction details, ` +
    `flat warm ivory-white background, antique paper tone, no gradient, no vignette`
  );
}

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  recommendation: TierRecommendationDto;
  gender?: string | null;
}) {
  const tier = input.tierLabel.toLowerCase();

  // Anchor: use the raw input verbatim — NOT shortenPieceName() (which caps at 6 words
  // and would strip silhouette-defining detail from the anchor description).
  // This is either the OpenAI vision-derived structural description from
  // describeAnchorForSketch, or the plain-text anchorItemDescription as fallback.
  const anchor = input.anchorItemDescription.trim();

  // Supporting pieces only (never include the anchor here — it is declared separately
  // as a locked primary constraint and must not compete with its own description).
  const keyPieces = input.recommendation.keyPieces.slice(0, 4).map(pieceLabel);
  const shoes = input.recommendation.shoes.slice(0, 1).map(pieceLabel);

  const wornAccessories = input.recommendation.accessories
    .filter((p) => classifyAccessory(p) === 'worn')
    .slice(0, 3)
    .map(pieceLabel);

  const besideAccessories = input.recommendation.accessories
    .filter((p) => classifyAccessory(p) === 'beside')
    .slice(0, 2)
    .map(pieceLabel);

  const supporting = [...keyPieces, ...shoes].filter(Boolean).join(', ');

  const wornPart = wornAccessories.length > 0
    ? `${wornAccessories.join(', ')} visible`
    : null;

  const besidePart = besideAccessories.length > 0
    ? `${besideAccessories.join(', ')} beside`
    : 'accessories beside';

  // Anchor locking:
  // - Anchor is declared BEFORE the tier label so it occupies high-weight token positions.
  // - "preserve category and construction exactly" is a direct fidelity instruction to Flux.
  // - Tier is positioned as "outfit built around the anchor" — a modifier, not a declaration.
  //   This prevents "business attire" / "smart casual" from activating a tier-appropriate
  //   garment archetype (blazer, chino-and-overshirt) before the anchor registers.
  const anchorLock = `anchor: ${anchor}, preserve category and construction exactly`;

  return [
    'headless mannequin, full-length fashion illustration, complete figure visible from neck to feet, full pants length visible, shoes fully visible at bottom of frame, feet touching ground, no cropping at ankles or feet',
    anchorLock,
    `${tier} outfit built around the anchor item`,
    supporting,
    wornPart,
    besidePart,
    'warm ivory watercolor wash background, antique paper tone',
  ]
    .filter(Boolean)
    .join(', ');
}
