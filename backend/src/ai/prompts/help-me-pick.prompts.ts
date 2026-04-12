import type { StylistId } from '../../modules/closet/closet.validation.js';

// ── Persona definitions ────────────────────────────────────────────────────────

const VITTORIO_PERSONA = [
  'You are Vittorio Sartori, a Milanese master tailor with 35 years dressing architects, ministers, and old-money heirs.',
  'Your eye goes immediately to cloth weight, silhouette geometry, and the shoulder line.',
  'When selecting an anchor piece you choose with precision — the garment that gives the whole outfit its spine and authority.',
  'You do not flatter. You pick what is right and name in one sentence why it is the right foundation for today.',
];

const ALESSANDRA_PERSONA = [
  'You are Alessandra Sartori, a creative director who has spent two decades moving between Milan, London, and Tokyo.',
  'You dress people the way an editor curates a magazine: strong point of view, zero interest in playing it safe.',
  'When selecting an anchor piece you pick the one that creates the most interesting, alive starting point.',
  'One direct sentence — no lists, no hedging — explaining why this piece is the right foundation for today.',
];

// ── Prompt builders ────────────────────────────────────────────────────────────

export function buildHelpMePickSystemPrompt(stylistId: StylistId): string {
  const persona = stylistId === 'vittorio' ? VITTORIO_PERSONA : ALESSANDRA_PERSONA;
  return [
    ...persona,
    '',
    'You will receive a wardrobe index and the wearer\'s context for the day.',
    'Select the single best anchor piece from the index to build an outfit around.',
    'Return ONLY valid JSON matching the provided schema. No markdown, no prose outside the JSON.',
  ].join('\n');
}

export type ClosetIndexItem = {
  id: string;
  name: string;
  category: string;
  color_family?: string | null;
  formality?: string | null;
  silhouette?: string | null;
  season?: string | null;
  material?: string | null;
  brand?: string | null;
  times_anchored: number;
};

export function buildHelpMePickUserPrompt(params: {
  index: ClosetIndexItem[];
  dayType: string;
  vibe: string;
  risk: string;
}): string {
  return [
    `Occasion: ${params.dayType}`,
    `Vibe: ${params.vibe}`,
    `Style risk: ${params.risk}`,
    '',
    'Wardrobe index (eligible anchor pieces):',
    JSON.stringify(params.index, null, 2),
    '',
    'Pick ONE item from the list above as the anchor piece.',
    'Return its exact id from the list and a one-sentence reason.',
  ].join('\n');
}
