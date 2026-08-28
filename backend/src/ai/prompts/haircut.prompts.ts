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
// and every session tries the same well-known trendy cuts.
export const HAIRCUT_STYLES: HaircutStyle[] = [
  { key: 'textured-quiff', label: 'Textured Quiff', summary: 'Voluminous, textured hair swept up and back with soft movement and a natural side part.' },
  { key: 'modern-crew-cut', label: 'Modern Crew Cut', summary: 'Short, neat, tapered sides with a slightly longer textured top.' },
  { key: 'slick-back-undercut', label: 'Slick Back Undercut', summary: 'Disconnected undercut with the top slicked straight back for a sharp, polished look.' },
  { key: 'textured-crop', label: 'Textured Crop', summary: 'Short textured fringe with a low fade and a messy, natural finish.' },
  { key: 'classic-side-part', label: 'Classic Side Part', summary: 'Sharp, defined side part with a clean taper — polished and timeless.' },
  { key: 'buzz-fade', label: 'Buzz Fade', summary: 'Very short, uniform buzz cut with a skin fade at the sides.' },
];

export function buildHaircutEditPrompt(style: Pick<HaircutStyle, 'label' | 'summary'>): string {
  return [
    'This is a real photo of a real person. Edit ONLY their hairstyle.',
    'Preserve EXACTLY as shown in the original photo: their face, facial features, skin tone, facial hair, expression, head pose, camera angle, lighting, clothing, and background. Do not change anything about the person\'s identity or the scene.',
    `Change their hairstyle to: ${style.label} — ${style.summary}`,
    'The output must look like a photorealistic, unedited photo of the SAME person — not an illustration, not a different person, not a different photo. The only difference from the original photo should be the hair.',
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
