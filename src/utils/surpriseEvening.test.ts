import { describe, expect, it } from 'vitest';
import { buildEveningRecap, generateSurpriseEvening } from './surpriseEvening';

describe('surpriseEvening', () => {
  it('generates a valid surprise preset', () => {
    const surprise = generateSurpriseEvening();
    expect(surprise.eveningTitle.length).toBeGreaterThan(0);
    expect(surprise.gameFormat).toBeTruthy();
    expect(surprise.scoringMode).toBeTruthy();
    expect(surprise.surpriseMessage.length).toBeGreaterThan(0);
  });

  it('builds evening recap lines', () => {
    const recap = buildEveningRecap({
      stats: { totalCompleted: 8, totalSkipped: 2, maxStreak: 4 },
      eveningName: 'ערב הפתעה',
      contentMode: 'tasks',
    });
    expect(recap.title).toBe('ערב הפתעה');
    expect(recap.lines).toHaveLength(4);
  });
});
