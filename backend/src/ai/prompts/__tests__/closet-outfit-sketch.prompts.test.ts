import { describe, it, expect } from 'vitest';

import { buildClosetOutfitSketchPrompt, type ClosetOutfitSketchItem } from '../closet-outfit-sketch.prompts.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function item(overrides: Partial<ClosetOutfitSketchItem> & { title: string; category: string }): ClosetOutfitSketchItem {
  return overrides;
}

const POLO = item({ title: 'Navy Cashmere Johnny Collar Polo Sweater', category: 'Knitwear' });
const TEE = item({ title: 'Black Merino Crewneck Tee', category: 'T-Shirt' });
const SHIRT = item({ title: 'White Oxford Shirt', category: 'Shirt' });
const BLAZER = item({ title: 'Navy Check Blazer', category: 'Blazer' });
const COAT = item({ title: 'Beige Single-Breasted Mac Coat', category: 'Coat' });
const TROUSERS = item({ title: 'Taupe Wool Trousers', category: 'Trousers' });
const SNEAKERS = item({ title: 'White Leather Sneakers', category: 'Sneakers' });
const WATCH = item({ title: 'Black Ceramic Watch', category: 'Watch' });

// ── Top layering order (this session's bug fix) ──────────────────────────────

describe('buildClosetOutfitSketchPrompt — top layering order', () => {
  it('emits a TOP LAYERING ORDER rule when primaryTop and a standalone knit secondary top both appear — the previously-missing instruction that caused the primary top to silently vanish from the sketch', () => {
    const prompt = buildClosetOutfitSketchPrompt({
      outfitTitle: 'Test',
      items: [TEE, POLO, TROUSERS, SNEAKERS, WATCH],
    });
    expect(prompt).toContain('TOP LAYERING ORDER');
    expect(prompt).toContain(TEE.title);
    expect(prompt).toContain(POLO.title);
    // States the order explicitly: base layer vs. visible outer layer.
    expect(prompt).toContain('worn as the base layer closest to the body');
    expect(prompt).toContain('worn OVER it as the visible outer top layer');
  });

  it('still emits the rule when a true outerwear piece (coat) is also present — layering order is independent of the separate LAYERING UNDER OUTERWEAR rule', () => {
    const prompt = buildClosetOutfitSketchPrompt({
      outfitTitle: 'Test',
      items: [TEE, POLO, COAT, TROUSERS, SNEAKERS, WATCH],
    });
    expect(prompt).toContain('TOP LAYERING ORDER');
    expect(prompt).toContain('LAYERING UNDER OUTERWEAR');
  });

  it('does not emit the rule when there is only a primary top and no standalone knit layer', () => {
    const prompt = buildClosetOutfitSketchPrompt({
      outfitTitle: 'Test',
      items: [SHIRT, TROUSERS, SNEAKERS, WATCH],
    });
    expect(prompt).not.toContain('TOP LAYERING ORDER');
  });

  it('does not emit the rule when the "over" layer is a true outerwear category (blazer) — that case is already covered by the secondary-top-under-a-jacket construction rule, not this one', () => {
    const prompt = buildClosetOutfitSketchPrompt({
      outfitTitle: 'Test',
      items: [SHIRT, BLAZER, TROUSERS, SNEAKERS, WATCH],
    });
    expect(prompt).not.toContain('TOP LAYERING ORDER');
  });

  it('instructs the primary top to show a visible collar/cuff/hem rather than being fully concealed or dropped', () => {
    const prompt = buildClosetOutfitSketchPrompt({
      outfitTitle: 'Test',
      items: [SHIRT, POLO, TROUSERS, SNEAKERS, WATCH],
    });
    expect(prompt).toContain('MUST still read as present');
    expect(prompt).toContain('collar, cuff, or hem');
  });
});
