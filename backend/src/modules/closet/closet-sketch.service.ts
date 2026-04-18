import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { logger } from '../../config/logger.js';
import { storageConfig } from '../../config/storage.js';
import { env } from '../../config/env.js';
import { openAiClient } from '../../ai/openai-client.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { buildClosetItemSketchPrompt } from '../../ai/prompts/sketch.prompts.js';
import type { ClosetItemSketchInput } from '../../ai/prompts/sketch.prompts.js';
import { closetRepository } from './closet.repository.js';

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING
//
//   generateClosetItemSketch  →  OpenAI gpt-image-1  (this file)
//   generateOutfitSketch      →  fal.ai Flux-LoRA    (tier-sketch.service.ts)
//
// Do NOT add fal.ai calls here. Do NOT add OpenAI image calls to tier-sketch.
// ─────────────────────────────────────────────────────────────────────────────

// ── Category routing keywords ─────────────────────────────────────────────────

const FOOTWEAR_CATEGORY_KEYWORDS = [
  'shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'loafer', 'loafers',
  'oxford', 'derby', 'brogue', 'chelsea', 'monk', 'mule', 'sandal', 'sandals',
  'slipper', 'trainer', 'trainers', 'runner', 'runners', 'footwear',
  'heel', 'heels', 'pump', 'pumps', 'espadrille',
];

const ACCESSORY_CATEGORY_KEYWORDS = [
  'sunglass', 'glasses', 'eyewear', 'spectacle',
  'watch', 'timepiece',
  'bag', 'tote', 'backpack', 'briefcase', 'clutch', 'handbag', 'wallet',
  'belt',
  'hat', 'cap', 'beanie', 'fedora', 'beret',
  'jewellery', 'jewelry', 'bracelet', 'necklace', 'ring', 'earring',
  'scarf', 'gloves',
];

function isFootwearItem(category?: string | null, title?: string | null): boolean {
  const haystack = `${category ?? ''} ${title ?? ''}`.toLowerCase();
  return FOOTWEAR_CATEGORY_KEYWORDS.some((kw) => haystack.includes(kw));
}

function isAccessoryItem(category?: string | null, title?: string | null): boolean {
  const haystack = `${category ?? ''} ${title ?? ''}`.toLowerCase();
  return ACCESSORY_CATEGORY_KEYWORDS.some((kw) => haystack.includes(kw));
}

// ── Image utility ─────────────────────────────────────────────────────────────

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  // Prefer reading directly from disk — faster and avoids self-HTTP requests on Render.
  const mediaPrefix = `${storageConfig.publicBaseUrl}/media/`;
  if (imageUrl.startsWith(mediaPrefix)) {
    const storageKey = imageUrl.slice(mediaPrefix.length);
    const filePath = path.join(storageConfig.localDirectory, storageKey);
    try {
      const buffer = await fsPromises.readFile(filePath);
      const ext = path.extname(storageKey).toLowerCase().replace('.', '');
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch {
      // File not on disk — fall through to HTTP fetch
    }
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image fetch failed with HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const mimeType = contentType.split(';')[0]?.trim() ?? 'image/jpeg';
  return `data:${mimeType};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

// ── Footwear analysis schema ───────────────────────────────────────────────────
// Much richer than the garment schema — captures the specific construction cues
// that distinguish technical sneakers from generic ones, etc.

const footwearDescriptionSchema = z.object({
  type:                z.string(),  // "low-top technical sneaker", "chelsea boot", "suede derby"
  color:               z.string(),  // primary color with undertone, e.g. "off-white with warm ivory cast"
  colorDetails:        z.string(),  // multi-zone breakdown: upper, sole, accent panels
  primaryMaterial:     z.string(),  // "smooth grain leather upper", "knit mesh upper"
  secondaryMaterials:  z.string(),  // "elastic knit gore insert, molded rubber outsole"
  toeShape:            z.string(),  // "sleek almond toe", "rounded square toe", "sharp pointed toe", "round bulbous toe"
  silhouetteProfile:   z.string(),  // "slim low-profile silhouette", "chunky platform construction"
  vampConstruction:    z.string(),  // "slip-on elastic vamp with cross-stitch detail", "apron-seamed U-moc vamp", "plain vamp with lace eyelets"
  fasteningSystem:     z.string(),  // "lace-up with 6 eyelets", "elastic gore slip-on", "side zip and elastic gusset", "single monk strap with buckle", "double monk strap"
  soleProfile:         z.string(),  // "thin minimal rubber outsole, barely visible from side", "thick lug sole with deep tread", "stacked leather heel with thin rubber bottom unit"
  heelType:            z.string(),  // "flat rubber heel matching outsole", "stacked leather heel", "block heel", "wedge"
  upperPaneling:       z.string(),  // "clean single-piece upper with minimal seaming", "multi-panel construction with visible seam lines at vamp/side"
  stitchingDetails:    z.string(),  // "tone-on-tone cross-stitch on elastic gore", "contrast white welt stitching", "no visible topstitching"
  hardwareDetails:     z.string(),  // "no hardware", "gunmetal D-ring eyelets", "silver buckle", "brass speed hooks"
  distinctiveFeatures: z.string(),  // the ONE or TWO most singular identifiers that make this shoe unmistakable
  brandLanguage:       z.string(),  // "luxury Italian technical sneaker", "heritage English shoemaking", "workwear utility boot"
  stylingNotes:        z.string(),  // overall impression: refined, raw, sporty, etc.
  mustPreserve:        z.array(z.string()).max(6),  // up to 6 non-negotiable product features
});

// ── Enhanced garment analysis schema ─────────────────────────────────────────
// Extends the original 6-field schema with construction and standout features.

const enhancedGarmentDescriptionSchema = z.object({
  type:                z.string(),  // "slim-fit chino trousers", "crewneck sweater", "double-breasted blazer"
  color:               z.string(),  // exact color with undertone
  material:            z.string(),  // fabric with finish
  silhouette:          z.string(),  // shape and fit
  details:             z.string(),  // visible construction: seams, hardware, pockets, cuffs, etc.
  constructionDetails: z.string(),  // collar shape, pocket configuration, closure type, hem finish, lining
  standoutFeatures:    z.string(),  // the 1-2 most visually distinctive design elements
  stylingNotes:        z.string(),  // overall aesthetic impression
  mustPreserve:        z.array(z.string()).max(5),  // 3-5 non-negotiable features for the sketch
});

// ── Footwear vision analysis ───────────────────────────────────────────────────

async function describeFootwearFromImage(
  imageUrl: string,
  supabaseUserId?: string,
): Promise<z.infer<typeof footwearDescriptionSchema>> {
  const dataUrl = await imageUrlToDataUrl(imageUrl);

  return openAiClient.createStructuredResponse({
    schema: footwearDescriptionSchema,
    jsonSchema: {
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
    },
    instructions: [
      'You are an expert footwear designer and product analyst. Your task is to extract the most precise, specific structured description of a shoe from the provided product image.',
      '',
      'CRITICAL: Do NOT use generic descriptions. Identify the exact construction details that make this specific shoe unique.',
      'If the shoe has a distinctive vamp construction (elastic gore, apron seam, U-moc), describe it precisely.',
      'If the sole is thin and minimalist versus chunky and lug-soled, capture that distinction with precision.',
      'The mustPreserve array must list the non-negotiable design cues that a sketch must capture — otherwise the rendering will look like a generic version of the category.',
      '',
      'Think like a footwear product developer writing a detailed brief for an illustrator.',
    ].join('\n'),
    userContent: [
      { type: 'input_image', image_url: dataUrl, detail: 'high' },
      {
        type: 'input_text',
        text: [
          'Analyze this shoe in precise technical detail.',
          'Focus especially on: vamp construction and any elastic/gore elements, toe box shape, sole profile from the side, fastening system, panel structure, stitching details, and any distinctive brand-adjacent design language.',
          'Be highly specific — avoid generic descriptions like "sneaker upper with rubber sole". Describe what makes THIS shoe distinct.',
          'Build the mustPreserve list with the 4-6 most critical features that would be lost if an illustrator drew a generic version of this shoe type.',
        ].join('\n'),
      },
    ],
    supabaseUserId,
    feature: 'closet-describe',
  });
}

// ── Enhanced garment vision analysis ─────────────────────────────────────────

async function describeGarmentFromImage(
  imageUrl: string,
  supabaseUserId?: string,
): Promise<z.infer<typeof enhancedGarmentDescriptionSchema>> {
  const dataUrl = await imageUrlToDataUrl(imageUrl);

  return openAiClient.createStructuredResponse({
    schema: enhancedGarmentDescriptionSchema,
    jsonSchema: {
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
    },
    instructions: [
      'You are an expert menswear product analyst and fashion illustrator briefer.',
      'Extract a precise, specific description of this garment for use in a fashion illustration brief.',
      '',
      'CRITICAL: Do NOT describe generic category versions. Identify the exact construction and design details that make this specific garment unique.',
      'The mustPreserve list must capture the visual cues that would be lost if an illustrator drew a generic version of this garment type.',
      '',
      'Think like a product developer writing a detailed brief for a fashion illustrator who must render this exact item.',
    ].join('\n'),
    userContent: [
      { type: 'input_image', image_url: dataUrl, detail: 'high' },
      {
        type: 'input_text',
        text: [
          'Describe this garment in precise technical detail for a fashion sketch brief.',
          'Focus on: exact color with undertone, material and finish, silhouette and fit, construction details (collar, pockets, closure, cuffs, hem), and the standout design features that make this specific piece distinctive.',
          'Avoid generic descriptions — be specific about what makes this garment different from a generic version of its category.',
          'Build the mustPreserve list with the 3-5 most critical visual features the sketch must capture.',
        ].join('\n'),
      },
    ],
    supabaseUserId,
    feature: 'closet-describe',
  });
}

// ── Build must-preserve block for sketch input ────────────────────────────────

function buildMustPreserveFromFootwear(
  shoe: z.infer<typeof footwearDescriptionSchema>,
): string[] {
  // Deduplicate and filter empty
  const candidates = [
    shoe.vampConstruction,
    shoe.toeShape,
    shoe.soleProfile,
    shoe.stitchingDetails,
    shoe.fasteningSystem,
    shoe.upperPaneling !== 'clean single-piece upper with minimal seaming' ? shoe.upperPaneling : null,
    shoe.hardwareDetails !== 'none' && shoe.hardwareDetails !== 'no hardware' ? shoe.hardwareDetails : null,
    shoe.distinctiveFeatures,
    ...shoe.mustPreserve,
  ].filter((v): v is string => v != null && v.length > 3);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return candidates
    .filter((s) => { const lower = s.toLowerCase(); if (seen.has(lower)) return false; seen.add(lower); return true; })
    .slice(0, 6);
}

// ── Sketch options ─────────────────────────────────────────────────────────────

type SketchOptions = {
  title?: string | null;
  category?: string;
  lensShape?: string | null;
  frameColor?: string | null;
};

// ── Main sketch generation ─────────────────────────────────────────────────────

async function generateClosetItemSketch(
  jobId: string,
  imageUrl: string,
  supabaseUserId?: string,
  options?: SketchOptions,
): Promise<void> {
  const category = options?.category ?? '';
  const title = options?.title ?? '';

  const isFootwear = isFootwearItem(category, title);
  const isAccessory = !isFootwear && isAccessoryItem(category, title);
  const isSunglasses = isAccessory &&
    `${category} ${title}`.toLowerCase().includes('sunglass');

  let sketchInput: ClosetItemSketchInput;
  let size: '1024x1024' | '1024x1536';

  if (isSunglasses) {
    const lensShape = options?.lensShape?.replace('_', '-') ?? null;
    const frameColor = options?.frameColor ?? null;
    sketchInput = {
      category: 'sunglasses',
      type: [frameColor ? `${frameColor}-frame` : null, lensShape ? `${lensShape} lens` : null, 'sunglasses'].filter(Boolean).join(' '),
      color: frameColor ?? 'as shown',
      details: 'frame shape, lens tint, hinge placement, arm structure, bridge width',
      orientation: 'front-facing at a slight angle so both lenses and the full frame are clearly visible',
    };
    size = '1024x1024';
    logger.info({ jobId, sketchInput }, 'Closet sketch: sunglasses input built');

  } else if (isFootwear) {
    const shoe = await describeFootwearFromImage(imageUrl, supabaseUserId);
    logger.info({ jobId, shoe }, 'Closet sketch: footwear description produced');

    const mustPreserve = buildMustPreserveFromFootwear(shoe);

    sketchInput = {
      category: 'footwear',
      type: shoe.type,
      color: shoe.color,
      colorDetails: shoe.colorDetails,
      material: shoe.primaryMaterial,
      secondaryMaterials: shoe.secondaryMaterials,
      silhouette: shoe.silhouetteProfile,
      toeShape: shoe.toeShape,
      vampConstruction: shoe.vampConstruction,
      fasteningSystem: shoe.fasteningSystem,
      soleProfile: shoe.soleProfile,
      heelType: shoe.heelType,
      upperPaneling: shoe.upperPaneling,
      stitchingDetails: shoe.stitchingDetails,
      hardwareDetails: shoe.hardwareDetails !== 'none' && shoe.hardwareDetails !== 'no hardware' ? shoe.hardwareDetails : undefined,
      distinctiveFeatures: shoe.distinctiveFeatures,
      brandLanguage: shoe.brandLanguage,
      stylingNotes: shoe.stylingNotes,
      mustPreserve,
    };
    size = '1024x1024'; // Square is better for isolated shoe renders

  } else if (isAccessory) {
    sketchInput = {
      category: options?.category ?? 'accessory',
      type: options?.title ?? options?.category ?? 'accessory',
      color: 'as shown',
      details: 'hardware, stitching, structure, material finish, edge treatment',
      orientation: 'isolated, product centered, slight 3-quarter angle to show depth',
    };
    size = '1024x1024';
    logger.info({ jobId, sketchInput }, 'Closet sketch: accessory input built');

  } else {
    const garment = await describeGarmentFromImage(imageUrl, supabaseUserId);
    logger.info({ jobId, garment }, 'Closet sketch: garment description produced');
    sketchInput = {
      category: options?.category ?? 'garment',
      type: garment.type,
      color: garment.color,
      material: garment.material,
      silhouette: garment.silhouette,
      details: garment.details,
      constructionDetails: garment.constructionDetails,
      standoutFeatures: garment.standoutFeatures,
      stylingNotes: garment.stylingNotes,
      mustPreserve: garment.mustPreserve,
    };
    size = '1024x1536';
  }

  const prompt = buildClosetItemSketchPrompt(sketchInput);
  logger.debug({ jobId, promptLength: prompt.length, mustPreserveCount: sketchInput.mustPreserve?.length ?? 0 }, 'Closet sketch: prompt built');

  const generatedImage = await openAiClient.generateImage({
    prompt,
    model: env.OPENAI_OUTFIT_SKETCH_MODEL,
    size,
    quality: env.OPENAI_OUTFIT_SKETCH_QUALITY,
    outputFormat: 'jpeg',
    supabaseUserId,
    feature: 'closet-sketch',
    costUsd: OPENAI_MINI_OUTFIT_SKETCH_COST_USD,
  });

  // Store image data in DB only (not on the ephemeral filesystem) so sketches
  // survive server restarts. The /media/closet-sketch/:filename handler serves
  // directly from this DB record.
  const storageKey = `closet-sketch/${jobId}.jpg`;
  const sketchImageUrl = `${storageConfig.publicBaseUrl}/media/${storageKey}`;

  await closetRepository.updateSketchJob(jobId, {
    status: 'ready',
    sketchImageUrl,
    sketchStorageKey: storageKey,
    sketchMimeType: generatedImage.mimeType,
    sketchImageData: generatedImage.data,
  });
}

async function runSketchJob(jobId: string, imageUrl: string, supabaseUserId?: string, options?: SketchOptions) {
  try {
    await generateClosetItemSketch(jobId, imageUrl, supabaseUserId, options);
  } catch (error) {
    logger.error({ jobId, error }, 'Closet item sketch generation failed');
    await closetRepository.updateSketchJob(jobId, {
      status: 'failed',
      sketchImageUrl: null,
      sketchStorageKey: null,
      sketchMimeType: null,
      sketchImageData: null,
    });
  }
}

export const closetSketchService = {
  async startSketchJob(imageUrl: string, supabaseUserId?: string, options?: SketchOptions): Promise<string> {
    const job = await closetRepository.createSketchJob();
    void runSketchJob(job.id, imageUrl, supabaseUserId, options);
    return job.id;
  },

  async getSketchJobStatus(jobId: string) {
    const job = await closetRepository.getSketchJob(jobId);
    if (!job) return null;
    return {
      sketchStatus: job.status as 'pending' | 'ready' | 'failed',
      sketchImageUrl: job.sketchImageUrl ?? null,
    };
  },
};
