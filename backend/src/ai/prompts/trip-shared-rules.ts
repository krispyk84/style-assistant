export function buildTripTemperatureRuleLines(avgHighC?: number): string[] {
  if (avgHighC == null) return [];
  if (avgHighC >= 24) {
    return [`- TEMPERATURE (avg high ${avgHighC}°C): HOT. Use ONLY lightweight, breathable fabrics (linen, cotton, jersey, silk). Absolutely NO coats, wool sweaters, heavy knitwear, parkas, or thick layers.`];
  }
  if (avgHighC >= 18) {
    return [`- TEMPERATURE (avg high ${avgHighC}°C): WARM. Light fabrics preferred. A light denim jacket or unlined blazer is the maximum outerwear — no heavy coats or wool.`];
  }
  if (avgHighC >= 10) {
    return [`- TEMPERATURE (avg high ${avgHighC}°C): MILD-COOL. Medium-weight layers acceptable; a jacket or light coat is fine. No heavy parkas or extreme cold-weather gear.`];
  }
  return [`- TEMPERATURE (avg high ${avgHighC}°C): COLD. Warm layers, coats, knitwear appropriate.`];
}

export const TRIP_DAY_BAG_RULE_LINES = [
  '- bag: ONE specific bag choice for this day, or null only if no bag is needed (e.g. a beach swim morning where pieces stay at the hotel). Do NOT default to "canvas tote" — choose the bag TYPE that fits this day\'s context.',
  '  • Bag types to pick from: briefcase, structured work bag, laptop bag, backpack, daypack, messenger, crossbody, shoulder bag, top-handle, satchel, tote, weekender, duffel, holdall, clutch, evening bag, belt bag, sling bag.',
  '  • business / meeting / conference days → briefcase, structured work bag, slim laptop bag, or refined leather messenger (NEVER a casual canvas tote).',
  '  • adventure / sightseeing on the move → backpack, daypack, sling bag, or compact crossbody.',
  '  • beach_pool → roomy summer tote, straw tote, or water-friendly crossbody (only when going to/from the beach, not while swimming).',
  '  • dinner_out / wedding_event → small structured handbag, top-handle, or clutch (women) / slim leather pouch or no bag (men).',
  '  • travel_day → weekender, duffel, or carry-all that doubles as a personal item.',
  '  • relaxed / sightseeing on foot → shoulder bag, crossbody, or compact tote — type chosen for the outfit\'s formality, not as a fallback.',
  '  • For menswear profiles, avoid clutches, top-handle handbags, hobo bags, or other feminine-coded bag silhouettes — choose briefcase, messenger, backpack, weekender, crossbody, or shoulder bag instead.',
  '  • The bag must match the day\'s formality and the outfit\'s palette/material story — describe color and material (e.g. "Tan grained-leather briefcase", "Black ripstop daypack", "Stone canvas weekender", "Cognac suede shoulder bag", "Black nappa-leather clutch").',
  '  • If the user provided an anchor-piece bag, build the day around that bag rather than introducing a different one.',
];

export const TRIP_REGENERATION_BAG_RULE =
  '- bag: pick the bag TYPE that fits the dayType — briefcase / structured work bag for business or meeting; backpack or sling for adventure; clutch or top-handle (or slim pouch / no bag for men) for dinner_out and wedding_event; tote or beach-friendly crossbody for beach_pool; weekender or duffel for travel_day; shoulder bag, messenger, or crossbody for sightseeing and relaxed days. Never default to "canvas tote" unless the day context (e.g. casual beach errand) genuinely calls for one. For menswear profiles, avoid clutches and top-handle handbags. Set bag to null only if the day truly needs no bag.';
