import { describe, expect, it } from 'vitest';
import type { Condition, Observation, Patient } from '@medplum/fhirtypes';
import {
  buildCkmStageObservation,
  evaluateCkmStage,
  extractCkmInput,
  LOINC,
  SNOMED,
  SYSTEM,
  type CkmInput,
} from '../src/index.js';

const saludable: CkmInput = {
  sexo: 'female',
  bmi: 23,
  waistCm: 78,
  systolicMmHg: 112,
  diastolicMmHg: 72,
  fastingGlucoseMgDl: 88,
  hba1cPercent: 5.2,
  triglyceridesMgDl: 90,
  hdlMgDl: 62,
  acrMgG: 8,
};

describe('evaluateCkmStage', () => {
  it('estadio 0 con datos completos y saludables', () => {
    const r = evaluateCkmStage(saludable);
    expect(r.stage).toBe(0);
    expect(r.criterios).toHaveLength(0);
    expect(r.datosSuficientes).toBe(true);
  });

  it('no afirma estadio 0 sin datos suficientes', () => {
    const r = evaluateCkmStage({ sexo: 'female', bmi: 22 });
    expect(r.stage).toBeUndefined();
    expect(r.datosSuficientes).toBe(false);
    expect(r.faltantes.length).toBeGreaterThan(0);
  });

  it('estadio 1 por cintura aumentada (mujer >= 88 cm)', () => {
    const r = evaluateCkmStage({ ...saludable, waistCm: 92 });
    expect(r.stage).toBe(1);
    expect(r.criterios.map((c) => c.key)).toContain('cintura');
  });

  it('estadio 1 por prediabetes (HbA1c 5.7-6.4)', () => {
    const r = evaluateCkmStage({ ...saludable, hba1cPercent: 5.9 });
    expect(r.stage).toBe(1);
    expect(r.criterios.map((c) => c.key)).toContain('prediabetes');
  });

  it('estadio 2 por presion elevada, trigliceridos o diabetes', () => {
    expect(evaluateCkmStage({ ...saludable, systolicMmHg: 138 }).stage).toBe(2);
    expect(evaluateCkmStage({ ...saludable, triglyceridesMgDl: 160 }).stage).toBe(2);
    expect(evaluateCkmStage({ ...saludable, hba1cPercent: 7.1 }).stage).toBe(2);
  });

  it('estadio 2 por sindrome metabolico computado (3 de 5)', () => {
    const r = evaluateCkmStage({
      ...saludable,
      waistCm: 95,
      triglyceridesMgDl: 155,
      hdlMgDl: 44,
    });
    expect(r.criterios.map((c) => c.key)).toContain('sindrome-metabolico');
    expect(r.stage).toBe(2);
  });

  it('estadio 2 por albuminuria moderada; 3 por severa o eGFR < 30', () => {
    expect(evaluateCkmStage({ ...saludable, acrMgG: 45 }).stage).toBe(2);
    expect(evaluateCkmStage({ ...saludable, acrMgG: 350 }).stage).toBe(3);
    expect(evaluateCkmStage({ ...saludable, egfr: 25 }).stage).toBe(3);
  });

  it('estadio 4a por CVD clinica; 4b con falla renal', () => {
    const a = evaluateCkmStage({ ...saludable, conditions: { clinicalCvd: true } });
    expect(a.stage).toBe(4);
    expect(a.subStage).toBe('4a');
    const b = evaluateCkmStage({ ...saludable, egfr: 12, conditions: { clinicalCvd: true } });
    expect(b.subStage).toBe('4b');
  });
});

describe('extractCkmInput', () => {
  const paciente: Patient = { resourceType: 'Patient', id: 'p1', gender: 'female' };
  const obs = (code: string, value: number, when: string): Observation => ({
    resourceType: 'Observation',
    status: 'final',
    code: { coding: [{ system: SYSTEM.loinc, code }] },
    valueQuantity: { value },
    effectiveDateTime: when,
  });

  it('toma la ultima observacion por fecha y lee componentes de presion', () => {
    const panel: Observation = {
      resourceType: 'Observation',
      status: 'final',
      code: { coding: [LOINC.bloodPressurePanel] },
      effectiveDateTime: '2026-07-01',
      component: [
        { code: { coding: [LOINC.systolicBloodPressure] }, valueQuantity: { value: 136 } },
        { code: { coding: [LOINC.diastolicBloodPressure] }, valueQuantity: { value: 86 } },
      ],
    };
    const input = extractCkmInput({
      patient: paciente,
      observations: [
        obs(LOINC.waistCircumference.code!, 84, '2026-05-01'),
        obs(LOINC.waistCircumference.code!, 91, '2026-07-01'),
        panel,
      ],
    });
    expect(input.waistCm).toBe(91);
    expect(input.systolicMmHg).toBe(136);
    expect(input.diastolicMmHg).toBe(86);
    expect(input.sexo).toBe('female');
  });

  it('detecta condiciones SNOMED activas', () => {
    const condicion: Condition = {
      resourceType: 'Condition',
      subject: { reference: 'Patient/p1' },
      clinicalStatus: { coding: [{ code: 'active' }] },
      code: { coding: [SNOMED.hypertension] },
    };
    const input = extractCkmInput({ patient: paciente, conditions: [condicion] });
    expect(input.conditions?.hypertension).toBe(true);
  });
});

describe('buildCkmStageObservation', () => {
  it('registra el estadio con criterios como componentes', () => {
    const resultado = evaluateCkmStage({ ...saludable, waistCm: 95, triglyceridesMgDl: 160 });
    const observation = buildCkmStageObservation(resultado, { patient: 'Patient/p1', now: '2026-07-10' });
    expect(observation.code?.coding?.[0]?.code).toBe('estadio-ckm');
    expect(observation.valueCodeableConcept?.coding?.[0]?.code).toBe('estadio-ckm-2');
    expect(observation.component?.length).toBeGreaterThan(0);
    expect(observation.subject?.reference).toBe('Patient/p1');
  });

  it('rechaza registrar sin estadio', () => {
    const resultado = evaluateCkmStage({ sexo: 'female' });
    expect(() => buildCkmStageObservation(resultado, { patient: 'Patient/p1' })).toThrow();
  });
});
