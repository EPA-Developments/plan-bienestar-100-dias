import { describe, expect, it } from 'vitest';
import type { Patient } from '@medplum/fhirtypes';
import {
  MENOPAUSE_PLAN,
  MENOPAUSE_PLAN_DEFINITION_URL,
  MENOPAUSE_QUESTIONNAIRE_URL,
  buildMenopauseCarePlan,
  buildMenopausePlanDefinition,
  evaluateEligibility,
} from '../src/index.js';

const HOY = '2026-07-10';

const maria: Patient = {
  resourceType: 'Patient',
  gender: 'female',
  birthDate: '1974-03-15', // 52 anios al 2026-07-10
};

describe('buildMenopausePlanDefinition', () => {
  it('publishes the canonical URL, active status and useContext gender+age', () => {
    const planDefinition = buildMenopausePlanDefinition({ now: HOY });

    expect(planDefinition.url).toBe(MENOPAUSE_PLAN_DEFINITION_URL);
    expect(planDefinition.status).toBe('active');
    expect(planDefinition.date).toBe(HOY);

    const genderContext = planDefinition.useContext?.find((c) => c.code?.code === 'gender');
    expect(genderContext?.valueCodeableConcept?.coding?.[0]?.code).toBe('female');

    const ageContext = planDefinition.useContext?.find((c) => c.code?.code === 'age');
    expect(ageContext?.valueRange?.low?.value).toBe(45);
    expect(ageContext?.valueRange?.high?.value).toBe(65);
  });

  it('maps every template goal and activity onto the definition', () => {
    const planDefinition = buildMenopausePlanDefinition();
    expect(planDefinition.goal).toHaveLength(MENOPAUSE_PLAN.goals.length);
    expect(planDefinition.action).toHaveLength(MENOPAUSE_PLAN.activities.length);

    const questionnaireActions = (planDefinition.action ?? []).filter(
      (action) => action.definitionCanonical === MENOPAUSE_QUESTIONNAIRE_URL,
    );
    expect(questionnaireActions.length).toBeGreaterThan(0);
  });

  it('accepts eligibility overrides (server-side rule editing)', () => {
    const planDefinition = buildMenopausePlanDefinition({
      eligibility: { genders: ['female'], ageRange: { low: 40, high: 60 } },
      status: 'draft',
    });
    const ageContext = planDefinition.useContext?.find((c) => c.code?.code === 'age');
    expect(ageContext?.valueRange?.low?.value).toBe(40);
    expect(ageContext?.valueRange?.high?.value).toBe(60);
    expect(planDefinition.status).toBe('draft');
  });
});

describe('evaluateEligibility', () => {
  const activePlan = buildMenopausePlanDefinition();

  it('matches a woman aged 45-65', () => {
    const result = evaluateEligibility(maria, activePlan, { on: HOY });
    expect(result.eligible).toBe(true);
    expect(result.age).toBe(52);
    expect(result.reasons).toHaveLength(0);
  });

  it('rejects by gender', () => {
    const carlos: Patient = { resourceType: 'Patient', gender: 'male', birthDate: '1974-03-15' };
    const result = evaluateEligibility(carlos, activePlan, { on: HOY });
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/sexo/);
  });

  it('rejects by age (younger and older than the range)', () => {
    const joven: Patient = { resourceType: 'Patient', gender: 'female', birthDate: '2000-01-01' };
    const mayor: Patient = { resourceType: 'Patient', gender: 'female', birthDate: '1950-01-01' };
    expect(evaluateEligibility(joven, activePlan, { on: HOY }).eligible).toBe(false);
    expect(evaluateEligibility(mayor, activePlan, { on: HOY }).eligible).toBe(false);
  });

  it('honours inclusive age bounds', () => {
    const exactly45: Patient = { resourceType: 'Patient', gender: 'female', birthDate: '1981-07-10' };
    const result = evaluateEligibility(exactly45, activePlan, { on: HOY });
    expect(result.age).toBe(45);
    expect(result.eligible).toBe(true);
  });

  it('rejects when the definition is retired (the "2 clicks" off switch)', () => {
    const retired = buildMenopausePlanDefinition({ status: 'retired' });
    const result = evaluateEligibility(maria, retired, { on: HOY });
    expect(result.eligible).toBe(false);
  });

  it('reports missing profile data instead of matching blindly', () => {
    const sinDatos: Patient = { resourceType: 'Patient' };
    const result = evaluateEligibility(sinDatos, activePlan, { on: HOY });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toHaveLength(2);
  });
});

describe('CarePlan <-> PlanDefinition linkage', () => {
  it('stamps instantiatesCanonical on the CarePlan', () => {
    const { carePlan } = buildMenopauseCarePlan({ patient: 'Patient/alice' });
    expect(carePlan.instantiatesCanonical).toEqual([MENOPAUSE_PLAN_DEFINITION_URL]);
  });
});
