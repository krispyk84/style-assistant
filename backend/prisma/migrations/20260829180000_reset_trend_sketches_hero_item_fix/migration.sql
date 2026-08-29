-- Existing TrendSketch rows were generated under a flawed hero-item-selection
-- prompt (it defaulted to footwear/accessories whenever any were listed,
-- regardless of what the trend was actually about — e.g. a tailoring trend
-- rendering a shoe). Pure AI-generated cache, safe to clear entirely: the
-- self-healing ensure/retry sweep already in place regenerates every row
-- fresh under the corrected prompt.
DELETE FROM "TrendSketch";
