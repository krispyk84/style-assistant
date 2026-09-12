import { describe, expect, it } from 'vitest';

import { buildTripTemperatureRuleLines } from '../trip-shared-rules.js';
import { weatherGates } from '../../../modules/closet/closet-taxonomy.js';

// ── What this file is ───────────────────────────────────────────────────────
//
// Phase R4: pins down the exact temperature-threshold boundaries of
// buildTripTemperatureRuleLines — the PROSE weather rule fed into the trip
// choice-step prompt (chooseFullClosetDay, trips.service.ts) — and documents
// its relationship to weatherGates, the CODE-side weather gate used by every
// closet-only generation path (this file, this engine, all three services).
//
// closet-outfits.prompts.ts has its own near-identical, separately-maintained
// prose function (buildTemperatureRule, private/unexported) using the exact
// same 24/18/10 boundaries and near-identical wording — verified directly
// against current HEAD. It is NOT exported, so it can't be differential-
// tested here without a production seam (out of scope for R4 — see the R4
// final report). This file only characterizes the one prose function that
// IS already exported and testable without any production change.
//
// This is characterization only: it documents what the prompt text says
// today, not what it should say. No production behavior was changed.

describe('buildTripTemperatureRuleLines — boundary values', () => {
  it('returns no rule at all when the average high is unknown (null/undefined)', () => {
    expect(buildTripTemperatureRuleLines(undefined)).toEqual([]);
  });

  it('below 10°C: COLD band', () => {
    expect(buildTripTemperatureRuleLines(9)[0]).toContain('COLD');
  });

  it('the MILD-COOL/COLD boundary is exactly 10°C', () => {
    expect(buildTripTemperatureRuleLines(9)[0]).toContain('COLD');
    expect(buildTripTemperatureRuleLines(9)[0]).not.toContain('MILD-COOL');
    expect(buildTripTemperatureRuleLines(10)[0]).toContain('MILD-COOL');
  });

  it('the WARM/MILD-COOL boundary is exactly 18°C', () => {
    expect(buildTripTemperatureRuleLines(17)[0]).toContain('MILD-COOL');
    expect(buildTripTemperatureRuleLines(18)[0]).toContain('WARM');
  });

  it('the HOT/WARM boundary is exactly 24°C', () => {
    expect(buildTripTemperatureRuleLines(23)[0]).toContain('WARM');
    expect(buildTripTemperatureRuleLines(24)[0]).toContain('HOT');
  });
});

describe('buildTripTemperatureRuleLines vs. weatherGates — same 18/24 boundaries, but "10" means something different in each', () => {
  it('the 18°C and 24°C boundaries agree with weatherGates\' base gate for every tier', () => {
    // weatherGates: includeOuterwear flips false->true crossing below 24, and
    // the base gate (before any business override) flips again at 18. The
    // prose rule\'s HOT/WARM (24) and WARM/MILD-COOL (18) bands land on the
    // same two numbers.
    expect(weatherGates(24, 'casual').includeOuterwear).toBe(false); // HOT — matches prose "no coats"
    expect(weatherGates(23, 'casual').includeOuterwear).toBe(true); // WARM — matches prose "light jacket ok"
    expect(weatherGates(18, 'casual').includeThermalLayer).toBe(false); // WARM — matches prose "light fabrics"
    expect(weatherGates(17, 'casual').includeThermalLayer).toBe(true); // MILD-COOL/COLD — matches prose "layers ok"
  });

  it('"10" is NOT the same concept in both places — in weatherGates it only ever matters for BUSINESS-tier outerwear; the prose rule\'s MILD-COOL/COLD split at 10 applies to every tier\'s narrative text regardless of formality', () => {
    // weatherGates(10, 'casual') and weatherGates(10, 'smart-casual') are
    // completely unaffected by the number 10 — only 'business' reads it at all.
    expect(weatherGates(10, 'casual')).toEqual({ includeThermalLayer: true, includeOuterwear: true });
    expect(weatherGates(9, 'casual')).toEqual({ includeThermalLayer: true, includeOuterwear: true });
    // Yet the prose rule shown to the model for a CASUAL day still switches
    // its narrative band at the same number 10, independent of weatherGates.
    expect(buildTripTemperatureRuleLines(10)[0]).toContain('MILD-COOL');
    expect(buildTripTemperatureRuleLines(9)[0]).toContain('COLD');
  });
});
