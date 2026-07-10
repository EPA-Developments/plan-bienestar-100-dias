import { describe, expect, it } from 'vitest';
import type { Observation, Patient } from '@medplum/fhirtypes';
import {
  LOINC,
  SYSTEM,
  bandaAscvd,
  calculatePrevent,
  extractPreventInput,
  preventDataFaltante,
  type PreventInput,
} from '../src/index.js';

/**
 * Official AHA reference vector (Khan 2024, base model):
 * 50-year female, total chol 200, HDL 45, SBP 160, diabetes, on antihtn,
 * BMI 35, eGFR 90 -> 14.7 / 9.2 / 8.1 % at 10 years.
 */
const referencia: PreventInput = {
  sexo: 'female',
  edad: 50,
  colesterolTotalMgDl: 200,
  hdlMgDl: 45,
  systolicMmHg: 160,
  diabetes: true,
  fumadorActual: false,
  bmi: 35,
  egfr: 90,
  tratamientoHipertension: true,
  usaEstatina: false,
};

describe('calculatePrevent (vector oficial AHA)', () => {
  it('reproduce el riesgo a 10 anios: 14.7 / 9.2 / 8.1 %', () => {
    const r = calculatePrevent(referencia);
    expect(r).toBeDefined();
    expect(r?.diezAnios.totalCvd).toBe(14.7);
    expect(r?.diezAnios.ascvd).toBe(9.2);
    expect(r?.diezAnios.heartFailure).toBe(8.1);
  });

  it('estima el riesgo a 30 anios en el rango esperado (~53 / ~35 / ~39 %)', () => {
    // El vector oficial exacto es a 10 anios; los valores a 30 anios de la
    // fuente son aproximados ("~"). Verificamos que caigan en su entorno (±1).
    const r = calculatePrevent(referencia);
    expect(r?.treintaAnios.totalCvd).toBeCloseTo(53.6, 1);
    expect(r?.treintaAnios.ascvd).toBeCloseTo(35.9, 1);
    expect(r?.treintaAnios.heartFailure).toBeCloseTo(39.5, 1);
  });

  it('non-HDL directo (155) da el mismo resultado que total-HDL', () => {
    const conNoHdl = calculatePrevent({ ...referencia, colesterolTotalMgDl: undefined, colesterolNoHdlMgDl: 155 });
    expect(conNoHdl?.diezAnios.ascvd).toBe(9.2);
  });

  it('devuelve undefined si falta el colesterol (no se puede calcular)', () => {
    const sinColesterol = calculatePrevent({ ...referencia, colesterolTotalMgDl: undefined, hdlMgDl: undefined });
    expect(sinColesterol).toBeUndefined();
  });

  it('reporta los datos faltantes', () => {
    const faltan = preventDataFaltante({ sexo: 'female', edad: 55 });
    expect(faltan).toContain('colesterol HDL');
    expect(faltan).toContain('presion arterial');
    expect(faltan).toContain('funcion renal (eGFR)');
  });
});

describe('bandaAscvd', () => {
  it('clasifica en bajo / limite / intermedio / alto', () => {
    expect(bandaAscvd(3)).toBe('bajo');
    expect(bandaAscvd(6)).toBe('limite');
    expect(bandaAscvd(9.2)).toBe('intermedio');
    expect(bandaAscvd(22)).toBe('alto');
  });
});

describe('extractPreventInput', () => {
  it('arma los inputs desde Observations FHIR (incluye colesterol)', () => {
    const patient: Patient = { resourceType: 'Patient', id: 'p1', gender: 'female', birthDate: '1974-03-15' };
    const obs = (code: string, value: number): Observation => ({
      resourceType: 'Observation',
      status: 'final',
      code: { coding: [{ system: SYSTEM.loinc, code }] },
      valueQuantity: { value },
      effectiveDateTime: '2026-07-01',
    });
    const input = extractPreventInput({
      patient,
      on: '2026-07-10',
      observations: [
        obs(LOINC.totalCholesterol.code as string, 210),
        obs(LOINC.hdlCholesterol.code as string, 48),
        obs(LOINC.systolicBloodPressure.code as string, 132),
        obs(LOINC.egfr.code as string, 88),
      ],
    });
    expect(input.sexo).toBe('female');
    expect(input.edad).toBe(52);
    expect(input.colesterolTotalMgDl).toBe(210);
    expect(input.hdlMgDl).toBe(48);
    const r = calculatePrevent(input);
    expect(r).toBeDefined();
  });
});
