// ── Sensitivity-driven color rules ────────────────────────────────────────────
// Converts a 0-100 slider value into specific color-tolerance instructions
// injected into the LLM prompt. Category matching is always strict regardless
// of sensitivity; only color/shade tolerance changes.

export type SensitivityTier = 'LOW' | 'MEDIUM' | 'HIGH';

export function sensitivityTier(value: number): SensitivityTier {
  if (value >= 67) return 'HIGH';
  if (value >= 34) return 'MEDIUM';
  return 'LOW';
}

export function buildSensitivityInstructions(tier: SensitivityTier): string {
  if (tier === 'HIGH') {
    return `COLOR GATE — HIGH sensitivity (precise):
Items must be in the same COLOR FAMILY. Additionally, require similar tone/shade within the family:
  - Light blues (sky blue, powder blue, light blue) should match light blues, not dark blues (royal blue, cobalt)
  - Light greys (heather grey, silver, ash) should match light greys, not charcoal or graphite
  - Dark navy should match dark navy or midnight blue, not general blue
  - The STONE family can remain broad (stone, taupe, khaki, beige are all similar enough)
If the best same-category item has a noticeably different shade within the family, return null.
Only match when confident about BOTH category AND color shade.`;
  }

  if (tier === 'MEDIUM') {
    return `COLOR GATE — MEDIUM sensitivity (balanced):
Items must be in the same COLOR FAMILY.
Within a family, all shades are compatible — light grey and charcoal are both GREY; stone and taupe are both STONE.
NAVY and BLUE are different families — do not match them.
If no same-category item is in the same COLOR FAMILY, return null.`;
  }

  // LOW
  return `COLOR GATE — LOW sensitivity (forgiving):
Items must be in broadly the same color area. The families are intentionally broad — accept any shade variation within a family.
If the item has no color mentioned in its title, accept it as a neutral candidate (pass the color gate).
Be generous: if the color is in the general direction of the suggestion (e.g., both are warm neutrals, or both are cool blues), prefer matching over returning null.
Only return null when the colors are clearly on opposite ends of the spectrum (e.g., black vs white, navy vs orange).`;
}
