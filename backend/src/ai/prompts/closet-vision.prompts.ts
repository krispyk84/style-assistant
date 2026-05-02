// ─────────────────────────────────────────────────────────────────────────────
// Closet sketch vision prompts — used to describe an uploaded closet item
// (footwear or garment) in enough detail to drive a hyper-faithful fashion
// illustration. Paired with the matching zod schemas in closet.schemas.ts.
// ─────────────────────────────────────────────────────────────────────────────

// ── Footwear ──────────────────────────────────────────────────────────────────

export const FOOTWEAR_DESCRIPTION_JSON_SCHEMA = {
  name: 'footwear_description',
  description: 'Detailed structured description of a shoe for a hyper-faithful fashion illustration',
  schema: {
    type: 'object',
    properties: {
      type:                { type: 'string', description: 'Precise shoe type: e.g. "low-top technical sneaker", "suede chelsea boot", "wholecut oxford", "double monk strap"' },
      color:               { type: 'string', description: 'Primary color with exact undertone: e.g. "off-white with warm ivory cast and pale grey sole"' },
      colorDetails:        { type: 'string', description: 'Full color breakdown by zone: upper color, sole color, any accent panels, stitching color' },
      primaryMaterial:     { type: 'string', description: 'Main upper material: e.g. "smooth grain leather", "knit mesh", "suede nubuck", "full-grain calfskin"' },
      secondaryMaterials:  { type: 'string', description: 'Any secondary materials: elastic gore, rubber sole, leather lining, foam midsole, etc.' },
      toeShape:            { type: 'string', description: 'Precise toe geometry: "sleek almond", "rounded square", "sharp pointed", "round bulbous", "chisel toe"' },
      silhouetteProfile:   { type: 'string', description: 'Side silhouette: "slim low-profile with minimal sole", "chunky elevated platform", "elegant slender profile"' },
      vampConstruction:    { type: 'string', description: 'Vamp area construction: "slip-on with cross-stitched elastic gore", "plain vamp with 6 eyelet lacing", "apron-seamed U-moc"' },
      fasteningSystem:     { type: 'string', description: 'How the shoe closes: "lace-up", "elastic slip-on", "side zip", "single monk strap", "double monk strap", "no fastening (slip-on)"' },
      soleProfile:         { type: 'string', description: 'Sole unit from side view: thickness, tread, midsole presence, welt type' },
      heelType:            { type: 'string', description: 'Heel construction and height: "flat rubber", "stacked leather 20mm", "block heel 60mm", "wedge"' },
      upperPaneling:       { type: 'string', description: 'How the upper is constructed: single-piece, paneled, any visible seam lines and their placement' },
      stitchingDetails:    { type: 'string', description: 'Visible stitching: "cross-stitch on elastic gore", "contrast welt stitching", "tone-on-tone topstitch along vamp", "no visible stitching"' },
      hardwareDetails:     { type: 'string', description: 'Metal hardware: eyelets, buckles, speed hooks, D-rings, decorative rivets. State "none" if absent.' },
      distinctiveFeatures: { type: 'string', description: 'The 1-2 most singular design identifiers that make this specific shoe unmistakable — e.g. "elastic cross-stitch gore at vamp" or "apron toe seam with medallion brogue punching"' },
      brandLanguage:       { type: 'string', description: 'Aesthetic territory: "luxury Italian technical sneaker", "heritage English Goodyear-welted", "workwear utility", "minimalist Scandinavian"' },
      stylingNotes:        { type: 'string', description: 'Overall impression: refined, raw, sporty, dressy, etc.' },
      mustPreserve:        { type: 'array', items: { type: 'string' }, description: 'Up to 6 most critical product features that the sketch must preserve exactly. Be specific.' },
    },
    required: [
      'type', 'color', 'colorDetails', 'primaryMaterial', 'secondaryMaterials',
      'toeShape', 'silhouetteProfile', 'vampConstruction', 'fasteningSystem',
      'soleProfile', 'heelType', 'upperPaneling', 'stitchingDetails',
      'hardwareDetails', 'distinctiveFeatures', 'brandLanguage', 'stylingNotes', 'mustPreserve',
    ],
    additionalProperties: false,
  },
};

export const FOOTWEAR_DESCRIPTION_INSTRUCTIONS = [
  'You are an expert footwear designer and product analyst. Your task is to extract the most precise, specific structured description of a shoe from the provided product image.',
  '',
  'CRITICAL: Do NOT use generic descriptions. Identify the exact construction details that make this specific shoe unique.',
  'If the shoe has a distinctive vamp construction (elastic gore, apron seam, U-moc), describe it precisely.',
  'If the sole is thin and minimalist versus chunky and lug-soled, capture that distinction with precision.',
  'The mustPreserve array must list the non-negotiable design cues that a sketch must capture — otherwise the rendering will look like a generic version of the category.',
  '',
  'Think like a footwear product developer writing a detailed brief for an illustrator.',
].join('\n');

export const FOOTWEAR_DESCRIPTION_USER_TEXT = [
  'Analyze this shoe in precise technical detail.',
  'Focus especially on: vamp construction and any elastic/gore elements, toe box shape, sole profile from the side, fastening system, panel structure, stitching details, and any distinctive brand-adjacent design language.',
  'Be highly specific — avoid generic descriptions like "sneaker upper with rubber sole". Describe what makes THIS shoe distinct.',
  'Build the mustPreserve list with the 4-6 most critical features that would be lost if an illustrator drew a generic version of this shoe type.',
].join('\n');

// ── Garment ───────────────────────────────────────────────────────────────────

export const GARMENT_DESCRIPTION_JSON_SCHEMA = {
  name: 'garment_description',
  description: 'Detailed structured description of a garment for a hyper-faithful fashion illustration prompt',
  schema: {
    type: 'object',
    properties: {
      type:                { type: 'string', description: 'Specific garment type: e.g. "slim-fit chino trousers", "crewneck sweater", "double-breasted blazer with peak lapels"' },
      color:               { type: 'string', description: 'Exact color with undertone and depth: e.g. "dark navy", "warm camel", "off-white cream"' },
      material:            { type: 'string', description: 'Fabric and finish: e.g. "brushed cotton twill", "fine merino wool with ribbed trim"' },
      silhouette:          { type: 'string', description: 'Shape and fit: e.g. "slim tapered leg with mid-rise waist"' },
      details:             { type: 'string', description: 'Key construction details: seams, stitching, hardware, pockets, collar, cuffs, zipper, buttons' },
      constructionDetails: { type: 'string', description: 'Specific construction: collar shape and stand height, pocket placement and type, closure mechanism, hem finish, lining presence, shoulder construction, cuff style' },
      standoutFeatures:    { type: 'string', description: 'The 1-2 most visually distinctive design elements that set this garment apart from a generic version of its category' },
      stylingNotes:        { type: 'string', description: 'Overall aesthetic: tone, finish, mood, e.g. "refined, well-pressed, matte finish"' },
      mustPreserve:        { type: 'array', items: { type: 'string' }, description: '3-5 non-negotiable visual features that the sketch must render faithfully. Be specific.' },
    },
    required: ['type', 'color', 'material', 'silhouette', 'details', 'constructionDetails', 'standoutFeatures', 'stylingNotes', 'mustPreserve'],
    additionalProperties: false,
  },
};

export const GARMENT_DESCRIPTION_INSTRUCTIONS = [
  'You are an expert menswear product analyst and fashion illustrator briefer.',
  'Extract a precise, specific description of this garment for use in a fashion illustration brief.',
  '',
  'CRITICAL: Do NOT describe generic category versions. Identify the exact construction and design details that make this specific garment unique.',
  'The mustPreserve list must capture the visual cues that would be lost if an illustrator drew a generic version of this garment type.',
  '',
  'Think like a product developer writing a detailed brief for a fashion illustrator who must render this exact item.',
].join('\n');

export const GARMENT_DESCRIPTION_USER_TEXT = [
  'Describe this garment in precise technical detail for a fashion sketch brief.',
  'Focus on: exact color with undertone, material and finish, silhouette and fit, construction details (collar, pockets, closure, cuffs, hem), and the standout design features that make this specific piece distinctive.',
  'Avoid generic descriptions — be specific about what makes this garment different from a generic version of its category.',
  'Build the mustPreserve list with the 3-5 most critical visual features the sketch must capture.',
].join('\n');
