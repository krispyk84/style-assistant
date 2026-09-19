import { describe, expect, it } from 'vitest';

import { buildStylistGenerationPersonaRules } from '../stylist-generation-persona.prompts.js';
import { buildGenerateOutfitsInstructions } from '../outfits.prompts.js';

// ── What this file is ───────────────────────────────────────────────────────
//
// "Ask a Stylist" flow: proves the deterministic PROMPT/INSTRUCTION
// construction that carries the selected persona into generation — not
// subjective AI output (per this task's own instruction: don't try to test
// fashion judgment by asserting exact garments). Two things matter here:
// (1) Vittorio and Alessandra receive genuinely distinct instruction text,
// not the same generic prompt with a name swapped in; (2) the persona layer
// is additive — it never displaces the base/closet-only rules the existing
// engine already enforces.

describe('buildStylistGenerationPersonaRules — persona distinctness', () => {
  it('Vittorio receives generation guidance naming him and his styling instinct', () => {
    const rules = buildStylistGenerationPersonaRules('vittorio').join(' ');
    expect(rules).toContain('Vittorio');
    expect(rules).toContain('timeless');
    expect(rules).toContain('tailoring');
  });

  it('Alessandra receives generation guidance naming her and her styling instinct', () => {
    const rules = buildStylistGenerationPersonaRules('alessandra').join(' ');
    expect(rules).toContain('Alessandra');
    expect(rules).toContain('contemporary');
    expect(rules).toContain('surprise');
  });

  it('Vittorio and Alessandra receive genuinely different instruction text, not the same prompt with a name swapped', () => {
    const vittorioRules = buildStylistGenerationPersonaRules('vittorio');
    const alessandraRules = buildStylistGenerationPersonaRules('alessandra');
    expect(vittorioRules).not.toEqual(alessandraRules);
    // Not just different, but each carries content the other explicitly does not.
    expect(vittorioRules.join(' ')).not.toContain('surprise');
    expect(alessandraRules.join(' ')).not.toContain('restrained');
  });

  it("Alessandra's guidance adapts pronouns to the wearer's profile gender", () => {
    const menswear = buildStylistGenerationPersonaRules('alessandra', 'man').join(' ');
    const womenswear = buildStylistGenerationPersonaRules('alessandra', 'woman').join(' ');
    expect(menswear).toContain('himself');
    expect(womenswear).toContain('herself');
  });

  it("Vittorio's guidance does not vary by gender (his own persona rules are fixed)", () => {
    const forMan = buildStylistGenerationPersonaRules('vittorio', 'man');
    const forWoman = buildStylistGenerationPersonaRules('vittorio', 'woman');
    expect(forMan).toEqual(forWoman);
  });
});

// ── S2 fix: explicit user-brief / closet-only / weather precedence ─────────
//
// Pre-push audit finding: the persona block and buildAdditionalDetailsRule
// both independently call themselves a "HARD styling constraint" with no
// stated tie-breaker. Both stylists must receive the same explicit
// precedence instruction — this is a single shared rule (see
// buildStylistGenerationPersonaRules), not per-persona duplicated text.
describe('buildStylistGenerationPersonaRules — user-brief/closet-only/weather precedence', () => {
  it('Vittorio receives the precedence instruction', () => {
    const rules = buildStylistGenerationPersonaRules('vittorio').join(' ');
    expect(rules).toContain('PRECEDENCE');
    expect(rules).toContain("the user's stated brief");
  });

  it('Alessandra receives the same precedence instruction', () => {
    const rules = buildStylistGenerationPersonaRules('alessandra').join(' ');
    expect(rules).toContain('PRECEDENCE');
    expect(rules).toContain("the user's stated brief");
  });

  it('the precedence instruction explicitly names closet-only/inventory constraints as taking priority over the persona', () => {
    const vittorio = buildStylistGenerationPersonaRules('vittorio').join(' ');
    const alessandra = buildStylistGenerationPersonaRules('alessandra').join(' ');
    expect(vittorio).toContain('closet-only/available-inventory constraints');
    expect(alessandra).toContain('closet-only/available-inventory constraints');
  });

  it('the precedence instruction explicitly forbids inventing a piece to satisfy a persona preference (Alessandra\'s "stronger accessory" cannot manufacture one that isn\'t owned)', () => {
    const alessandra = buildStylistGenerationPersonaRules('alessandra').join(' ');
    expect(alessandra).toContain('never invent, add, or substitute a piece just to satisfy a persona preference');
  });

  it('the precedence rule is identical text for both stylists (one shared rule, not two independently-maintained copies)', () => {
    const vittorioRules = buildStylistGenerationPersonaRules('vittorio');
    const alessandraRules = buildStylistGenerationPersonaRules('alessandra');
    const precedenceLine = (rules: string[]) => rules.find((r) => r.includes('PRECEDENCE'));
    expect(precedenceLine(vittorioRules)).toBe(precedenceLine(alessandraRules));
  });
});

describe('buildGenerateOutfitsInstructions — persona is additive, not a replacement', () => {
  it('includes no persona rules when stylistId is absent (the original structured-form flow)', () => {
    const instructions = buildGenerateOutfitsInstructions(['smart-casual'], 'man', false);
    expect(instructions).not.toContain('STYLIST PERSONA');
    expect(instructions).not.toContain('Vittorio');
    expect(instructions).not.toContain('Alessandra');
  });

  it('splices in Vittorio-specific instructions when stylistId is "vittorio"', () => {
    const instructions = buildGenerateOutfitsInstructions(['smart-casual'], 'man', false, 'vittorio');
    expect(instructions).toContain('STYLIST PERSONA — VITTORIO');
  });

  it('splices in Alessandra-specific instructions when stylistId is "alessandra"', () => {
    const instructions = buildGenerateOutfitsInstructions(['smart-casual'], 'man', false, 'alessandra');
    expect(instructions).toContain('STYLIST PERSONA — ALESSANDRA');
  });

  it('the base outfit rules and closet-only rules remain present alongside the persona layer', () => {
    const withoutPersona = buildGenerateOutfitsInstructions(['smart-casual'], 'man', true);
    const withPersona = buildGenerateOutfitsInstructions(['smart-casual'], 'man', true, 'alessandra');
    // Every instruction present without a persona is still present with one —
    // the persona is additive, never a substitute for the base rules.
    expect(withPersona).toContain('expert menswear styling assistant');
    expect(withPersona).toContain('CLOSET-ONLY MODE');
    expect(withoutPersona.length).toBeLessThan(withPersona.length);
  });
});
