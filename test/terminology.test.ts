import { describe, expect, it } from 'vitest';
import { LOINC, SNOMED, SYSTEM } from '../src/index.js';

describe('terminology', () => {
  it('pins verified LOINC codes for the CKM lab panel', () => {
    expect(LOINC.nonHdlCholesterol.code).toBe('43396-1');
    expect(LOINC.fastingGlucose.code).toBe('1558-6');
    expect(LOINC.hba1c.code).toBe('4548-4');
    expect(LOINC.urineAlbuminCreatinineRatio.code).toBe('9318-7');
    expect(LOINC.waistCircumference.code).toBe('8280-0');
    expect(LOINC.systolicBloodPressure.code).toBe('8480-6');
  });

  it('pins verified SNOMED menopause codes', () => {
    expect(SNOMED.menopausePresent.code).toBe('289903006');
    expect(SNOMED.prematureMenopause.code).toBe('373717006');
  });

  it('gives every LOINC coding the loinc system, a code and a display', () => {
    for (const coding of Object.values(LOINC)) {
      expect(coding.system).toBe(SYSTEM.loinc);
      expect(coding.code).toMatch(/^\d{3,6}-\d$/);
      expect(coding.display && coding.display.length).toBeGreaterThan(0);
    }
  });

  it('gives every SNOMED coding the snomed system and a numeric code', () => {
    for (const coding of Object.values(SNOMED)) {
      expect(coding.system).toBe(SYSTEM.snomed);
      expect(coding.code).toMatch(/^\d+$/);
    }
  });
});
