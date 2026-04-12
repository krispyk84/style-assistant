/**
 * Heuristic anti-drift terms for text-only anchors (no image URL provided).
 * Prevents the image model from substituting the most common tier-archetype default
 * for the actual anchor garment category.
 * Returns null for categories that are unlikely to be misidentified.
 */

const ANTI_DRIFT_RULES: Array<{ pattern: RegExp; antiDrift: string }> = [
  // Shirts → prevent blazer/jacket substitution (smart-casual prior)
  { pattern: /\b(shirt|button.?down|oxford shirt|chambray|denim shirt|western shirt|flannel shirt|dress shirt|overshirt|shacket|chore coat)\b/,
    antiDrift: 'blazer, suit jacket, sport coat, sports jacket, navy jacket, structured jacket, formal jacket, navy blazer' },
  // Knitwear → prevent blazer AND bomber/chore/field jacket substitution.
  // The expanded negative covers the full range of "black zip garment" archetypes
  // the model defaults to under Smart Casual pressure (INC-009: quarter-zip → bomber/chore coat).
  { pattern: /\b(cardigan|crewneck|jumper|pullover|sweater|knitwear|quarter.?zip|half.?zip|turtleneck)\b/,
    antiDrift: 'blazer, suit jacket, sport coat, structured jacket, woven jacket, bomber jacket, chore jacket, chore coat, field jacket, overshirt, zip-front jacket, outerwear jacket' },
  // Sneakers → prevent boot/dress shoe substitution
  { pattern: /\b(sneaker|trainer|canvas shoe|court shoe|plimsoll|runner|running shoe|low-top|hi-top)\b/,
    antiDrift: 'boots, chelsea boots, chukka boots, desert boots, dress shoes, oxford shoes, loafers, brown leather boots, brown boots, tan boots' },
  // Loafers → prevent sneaker/boot substitution
  { pattern: /\b(loafer|penny loafer|moccasin|slip.?on)\b/,
    antiDrift: 'boots, sneakers, trainers, runners, oxford shoes' },
  // Boots → prevent sneaker/loafer substitution
  { pattern: /\b(chelsea boot|chukka boot|desert boot|ankle boot)\b/,
    antiDrift: 'sneakers, trainers, white shoes, canvas shoes, loafers' },
  // Trousers/chinos → prevent jeans substitution
  { pattern: /\b(trouser|chino|slack|dress pant|gabardine pant)\b/,
    antiDrift: 'jeans, denim, shorts, sweatpants' },
  // Denim/jeans → prevent chino substitution
  { pattern: /\b(denim|jean)\b/,
    antiDrift: 'chinos, dress trousers, formal trousers, smart trousers, suit trousers' },
];

export function extractTextBasedAntiDrift(anchorText: string): string | null {
  const norm = anchorText.toLowerCase();
  for (const { pattern, antiDrift } of ANTI_DRIFT_RULES) {
    if (pattern.test(norm)) return antiDrift;
  }
  return null;
}
