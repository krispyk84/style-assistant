// Prompt construction for the Haircut Planner feature.
// Two distinct AI calls: (1) Gemini photo-editing to render a haircut on the
// user's real headshot, (2) OpenAI structured text for the downloadable guide
// copy once the user has picked their favourite.

export type HaircutStyle = {
  key: string;
  label: string;
  summary: string;
};

// Curated, fixed set — deliberately not LLM-chosen, so results are predictable
// and every session tries the same well-known trendy cuts. A session starts
// with the first INITIAL_BATCH_SIZE styles; "see more" draws from the rest,
// in order, until the list is exhausted.
export const HAIRCUT_STYLES: HaircutStyle[] = [
  { key: 'textured-quiff', label: 'Textured Quiff', summary: 'Voluminous, textured hair swept up and back with soft movement and a natural side part.' },
  { key: 'modern-crew-cut', label: 'Modern Crew Cut', summary: 'Short, neat, tapered sides with a slightly longer textured top.' },
  { key: 'slick-back-undercut', label: 'Slick Back Undercut', summary: 'Disconnected undercut with the top slicked straight back for a sharp, polished look.' },
  { key: 'textured-crop', label: 'Textured Crop', summary: 'Short textured fringe with a low fade and a messy, natural finish.' },
  { key: 'classic-side-part', label: 'Classic Side Part', summary: 'Sharp, defined side part with a clean taper — polished and timeless.' },
  { key: 'buzz-fade', label: 'Buzz Fade', summary: 'Very short, uniform buzz cut with a skin fade at the sides.' },
  { key: 'curly-fringe', label: 'Curly Fringe', summary: 'Natural curls left longer on top and swept forward into a soft fringe, tight taper on the sides.' },
  { key: 'french-crop', label: 'French Crop', summary: 'Short blunt fringe with a textured crop on top and a mid fade on the sides.' },
  { key: 'pompadour', label: 'Modern Pompadour', summary: 'Bold volume swept straight up and back from the forehead, tight fade on the sides.' },
  { key: 'wavy-shag', label: 'Wavy Shag', summary: 'Longer, layered, textured cut with natural wave and a lived-in, undone finish.' },
  { key: 'ivy-league', label: 'Ivy League', summary: 'A tidy, slightly longer take on the crew cut with a soft side part and clean taper.' },
  { key: 'low-fade-afro', label: 'Textured Afro Fade', summary: 'Natural textured volume on top with a crisp low fade at the sides and back.' },
];

// Fixed fallback for womenswear sessions — same role as HAIRCUT_STYLES
// (used only when no hemisphere is known or no womenswear trend profile has
// been generated yet).
export const HAIRCUT_STYLES_WOMENSWEAR: HaircutStyle[] = [
  { key: 'long-layers', label: 'Long Layers', summary: 'Long length with soft face-framing layers cut throughout for movement and volume.' },
  { key: 'butterfly-cut', label: 'Butterfly Cut', summary: 'Long layered hairstyle with cascading face-framing feathery layers blown outward away from the face with high volume.' },
  { key: 'blunt-bob', label: 'Blunt Bob', summary: 'Chin-to-collarbone length blunt-cut bob with a clean, sharp horizontal hemline.' },
  { key: 'curtain-bangs-lob', label: 'Curtain Bangs Lob', summary: 'Long bob past the shoulders paired with soft, center-parted curtain bangs framing the face.' },
  { key: 'wolf-cut', label: 'Wolf Cut', summary: 'Heavily layered shag with a shorter, voluminous crown blending into longer, textured ends.' },
  { key: 'pixie-cut', label: 'Pixie Cut', summary: 'Very short, cropped cut with textured length on top and closely tapered sides and back.' },
  { key: 'classic-bob', label: 'Classic Bob', summary: 'Timeless jaw-length bob with a clean, rounded shape and subtle inward curve at the ends.' },
  { key: 'long-shag', label: 'Long Shag', summary: 'Long, heavily layered cut with a wispy fringe and textured, undone movement throughout.' },
  { key: 'sleek-straight-lob', label: 'Sleek Straight Lob', summary: 'Sleek, blunt shoulder-length cut worn straight and smooth with a deep side part.' },
  { key: 'curly-shag', label: 'Curly Shag', summary: 'Layered shag cut tailored for natural curls, with shorter face-framing pieces and defined curl clumps.' },
  { key: 'shoulder-length-waves', label: 'Shoulder-Length Waves', summary: 'Shoulder-grazing length styled in loose, natural waves with softly layered ends.' },
  { key: 'micro-fringe-bob', label: 'Micro Fringe Bob', summary: 'Chin-length bob paired with a short, blunt micro fringe cut above the brow.' },
];

export const INITIAL_BATCH_SIZE = 6;
export const MORE_BATCH_SIZE = 4;

export function buildHaircutEditPrompt(style: Pick<HaircutStyle, 'label' | 'summary'>): string {
  return [
    'This is a real photo of a real person. Edit ONLY their hairstyle.',
    'Preserve EXACTLY as shown in the original photo: their face, facial features, skin tone, facial hair, expression, head pose, camera angle, lighting, clothing, and background. Do not change anything about the person\'s identity or the scene.',
    `Change their hairstyle to: ${style.label} — ${style.summary}`,
    'Frame the output with the subject centered in the middle of the image, with roughly equal empty margin of background visible on the left side and the right side — even if the subject was positioned slightly off-center (e.g. shifted left or right) in the original photo. Keep the same zoom level/distance, camera angle, and vertical headroom as the original — only recenter them horizontally, do not zoom in, zoom out, or crop tighter.',
    'The output must look like a photorealistic, unedited photo of the SAME person — not an illustration, not a different person, not a different photo. The only difference from the original photo should be the hair and the horizontal centering.',
  ].join('\n');
}

export type HaircutAngle = 'top' | 'side' | 'back';

export const HAIRCUT_ANGLES: { angle: HaircutAngle; label: string }[] = [
  { angle: 'top', label: 'Top' },
  { angle: 'side', label: 'Side' },
  { angle: 'back', label: 'Back' },
];

const ANGLE_INSTRUCTIONS: Record<HaircutAngle, string> = {
  // A barber needs this angle, not a near-duplicate of the front shot — it
  // shows the crown pattern, part line, and top density/layering that a
  // front-on photo can't reveal.
  top:
    'Show this exact same styled hairstyle from directly above, looking straight down at the crown of the head — a top-down bird\'s-eye view. ' +
    'Clearly show the crown hair pattern or whorl, the part line and its exact position, and how the top length and layering are distributed across the scalp. ' +
    'The face will not be visible from this angle — that is expected and correct, do not try to show it. Preserve the same skin tone, hair color and texture, lighting style, and background as the reference photo.',
  side:
    'Show this exact same styled hairstyle from a direct side profile view (the head turned roughly 90 degrees), showing the ear and the full side silhouette of the cut clearly. ' +
    'The face will naturally be seen in profile rather than forward-facing — that is expected and correct for this angle. Preserve the same skin tone, facial hair, hair color and texture, lighting style, and background as the reference photo.',
  back:
    'Show this exact same styled hairstyle from directly behind the head, showing the back hairline, nape, and rear silhouette of the cut clearly. ' +
    'The face will not be visible from this angle — that is expected and correct, do not try to show it. Preserve the same skin tone, hair color and texture, lighting style, and background as the reference photo.',
};

export function buildHaircutAngleEditPrompt(style: Pick<HaircutStyle, 'label' | 'summary'>, angle: HaircutAngle): string {
  return [
    'This is a real photo of a real person who has already had their hair edited to a specific styled haircut. Generate a new photo of the SAME person with the SAME haircut, but from a different camera angle.',
    `Haircut already applied: ${style.label} — ${style.summary}`,
    ANGLE_INSTRUCTIONS[angle],
    'Center the subject\'s head and shoulders in the middle of the frame with roughly equal empty margin of background on the left and right — even if the reference photo itself was slightly off-center. Keep the same zoom level/distance and vertical headroom as the reference photo — do not crop tightly or leave large empty space on one side only.',
    'The output must look like a photorealistic, unedited photo of the SAME real person — not an illustration, not a different photo style, not a different person.',
  ].join('\n');
}

export function buildHaircutGuideSystemPrompt(): string {
  return [
    'You are an expert barber writing a concise, practical haircut guide for a client who is about to book an appointment.',
    'Write copy a client could show their barber and immediately be understood, and that helps the client maintain the cut themselves between visits.',
    'Be specific and concrete — avoid generic filler like "ask your barber for advice".',
    'Return ONLY valid JSON matching the provided schema. No markdown, no prose outside the JSON.',
  ].join('\n');
}

export function buildHaircutGuideUserPrompt(style: Pick<HaircutStyle, 'label' | 'summary'>): string {
  return [
    `Haircut: ${style.label}`,
    `Description: ${style.summary}`,
    '',
    'Write the guide content for this haircut:',
    '- theLook: one or two sentences describing the overall look and feel.',
    '- whatToAskFor: 3-5 short, specific phrases the client can say to their barber (e.g. exact clipper guard numbers, taper type, length in inches).',
    '- cutDetails: 3-5 short technical details of the cut (fade type, length on top vs sides, texture technique).',
    '- stylingTips: 3-5 short steps for styling it at home, in order.',
    '- whatToAvoid: 2-4 short common mistakes or requests that would ruin the look.',
    '- maintenance: one short sentence on trim frequency and at-home upkeep.',
    '- products: 2-4 short product-type recommendations (e.g. "matte clay for texture", not brand names).',
  ].join('\n');
}
