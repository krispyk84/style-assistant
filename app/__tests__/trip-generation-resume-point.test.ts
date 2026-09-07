import { describe, expect, it } from 'vitest';

import { computeTripGenerationResumePoint } from '../trip-results-mappers';

describe('computeTripGenerationResumePoint', () => {
  it('no previously generated days: starts at day 0, not yet complete', () => {
    const result = computeTripGenerationResumePoint({ numDays: 5, existingDays: undefined });
    expect(result).toEqual({ totalDays: 5, startIndex: 0, isAlreadyComplete: false });
  });

  it('some days already completed: resumes from the correct next day', () => {
    const existingDays = [{ id: 'day-0' }, { id: 'day-1' }] as never[];
    const result = computeTripGenerationResumePoint({ numDays: 5, existingDays });
    expect(result.startIndex).toBe(2);
    expect(result.isAlreadyComplete).toBe(false);
  });

  it('all days already completed: isAlreadyComplete is true', () => {
    const existingDays = [{ id: 'day-0' }, { id: 'day-1' }, { id: 'day-2' }] as never[];
    const result = computeTripGenerationResumePoint({ numDays: 3, existingDays });
    expect(result.isAlreadyComplete).toBe(true);
    expect(result.startIndex).toBe(3);
  });

  it('more days persisted than requested (numDays shrank) still reads as complete, not an overrun', () => {
    const existingDays = [{ id: 'day-0' }, { id: 'day-1' }, { id: 'day-2' }] as never[];
    const result = computeTripGenerationResumePoint({ numDays: 2, existingDays });
    expect(result.isAlreadyComplete).toBe(true);
  });

  it('caps totalDays at 8 regardless of a longer requested trip', () => {
    const result = computeTripGenerationResumePoint({ numDays: 14, existingDays: undefined });
    expect(result.totalDays).toBe(8);
  });

  it('an empty (but present) existingDays array is treated the same as no prior progress, not "already complete"', () => {
    const result = computeTripGenerationResumePoint({ numDays: 4, existingDays: [] });
    expect(result).toEqual({ totalDays: 4, startIndex: 0, isAlreadyComplete: false });
  });
});
