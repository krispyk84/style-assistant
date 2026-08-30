-- Existing ColorSwatchSketch rows were generated under a prompt that didn't
-- pin down edge style, shape, or size, so different colours came back with
-- inconsistent swatch treatments (smooth vs. pinked/jagged edges, different
-- aspect ratios and sizes). Pure AI-generated cache, safe to clear entirely:
-- the self-healing ensure/retry sweep already in place regenerates every row
-- fresh under the corrected, fully-specified prompt.
DELETE FROM "ColorSwatchSketch";
