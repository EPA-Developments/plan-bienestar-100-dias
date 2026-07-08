import { describe, expect, it } from 'vitest';
import type { CarePlan, Condition, Resource, Task } from '@medplum/fhirtypes';
import {
  MENOPAUSE_PLAN,
  SNOMED,
  buildMenopauseCarePlan,
  buildMenopauseCarePlanBundle,
  sequentialIdGenerator,
} from '../src/index.js';

const baseOptions = {
  patient: 'Patient/alice',
  lifeStage: 'perimenopausia' as const,
  now: '2026-07-08',
};

function resourcesOf(bundle: { entry?: { resource?: Resource }[] }): Resource[] {
  return (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter((resource): resource is Resource => resource !== undefined);
}

/** Recursively collect every `.reference` string in a resource tree. */
function collectReferences(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, acc);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'reference' && typeof child === 'string') acc.push(child);
      else collectReferences(child, acc);
    }
  }
  return acc;
}

describe('buildMenopauseCarePlanBundle', () => {
  it('produces a transaction bundle with all resource types', () => {
    const bundle = buildMenopauseCarePlanBundle({ ...baseOptions, idGenerator: sequentialIdGenerator() });
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('transaction');

    const types = resourcesOf(bundle).map((r) => r.resourceType);
    expect(types).toContain('CarePlan');
    expect(types).toContain('CareTeam');
    expect(types).toContain('Condition');
    expect(types).toContain('Questionnaire');
    expect(types.filter((t) => t === 'Goal')).toHaveLength(MENOPAUSE_PLAN.goals.length);
    expect(types.filter((t) => t === 'Task')).toHaveLength(MENOPAUSE_PLAN.activities.length);
  });

  it('marks every entry as a POST create keyed by resource type', () => {
    const bundle = buildMenopauseCarePlanBundle(baseOptions);
    for (const entry of bundle.entry ?? []) {
      expect(entry.request?.method).toBe('POST');
      expect(entry.fullUrl).toMatch(/^urn:uuid:/);
      expect(entry.request?.url).toBe(entry.resource?.resourceType);
      // POST creates must not carry a server id.
      expect(entry.resource?.id).toBeUndefined();
    }
  });

  it('resolves every internal urn:uuid reference to a bundle entry', () => {
    const bundle = buildMenopauseCarePlanBundle(baseOptions);
    const fullUrls = new Set((bundle.entry ?? []).map((e) => e.fullUrl));
    const internalRefs = collectReferences(bundle).filter((ref) => ref.startsWith('urn:uuid:'));
    expect(internalRefs.length).toBeGreaterThan(0);
    for (const ref of internalRefs) {
      expect(fullUrls.has(ref)).toBe(true);
    }
  });

  it('wires the CarePlan to goals, activities, care team and condition', () => {
    const { bundle, carePlan, goals, tasks, condition } = buildMenopauseCarePlan(baseOptions);
    const fullUrlByResource = new Map(
      (bundle.entry ?? []).map((e) => [e.resource, e.fullUrl] as const),
    );

    expect(carePlan.goal).toHaveLength(goals.length);
    expect(carePlan.activity).toHaveLength(tasks.length);

    const goalUrls = new Set(goals.map((g) => fullUrlByResource.get(g)));
    for (const ref of carePlan.goal ?? []) {
      expect(goalUrls.has(ref.reference)).toBe(true);
    }

    const taskUrls = new Set(tasks.map((t) => fullUrlByResource.get(t)));
    for (const activity of carePlan.activity ?? []) {
      expect(taskUrls.has(activity.reference?.reference)).toBe(true);
    }

    expect(carePlan.careTeam?.[0]?.reference).toMatch(/^urn:uuid:/);
    expect(carePlan.addresses?.[0]?.reference).toBe(fullUrlByResource.get(condition as Resource));
    expect((carePlan as CarePlan).subject?.reference).toBe('Patient/alice');
  });

  it('uses the life-stage SNOMED coding on the addressed condition', () => {
    const { condition } = buildMenopauseCarePlan(baseOptions);
    expect((condition as Condition).code?.coding?.[0]?.code).toBe(SNOMED.perimenopausalState.code);
  });

  it('links the questionnaire task to the Questionnaire', () => {
    const { tasks, questionnaire, bundle } = buildMenopauseCarePlan(baseOptions);
    const questionnaireUrl = (bundle.entry ?? []).find((e) => e.resource === questionnaire)?.fullUrl;
    const questionnaireTask = tasks.find((t: Task) => t.focus?.reference !== undefined);
    expect(questionnaireTask).toBeDefined();
    expect(questionnaireTask?.focus?.reference).toBe(questionnaireUrl);
  });

  it('omits the questionnaire and condition when disabled', () => {
    const { questionnaire, condition, tasks, carePlan } = buildMenopauseCarePlan({
      ...baseOptions,
      includeQuestionnaire: false,
      includeCondition: false,
    });
    expect(questionnaire).toBeUndefined();
    expect(condition).toBeUndefined();
    expect(carePlan.addresses).toBeUndefined();
    // With no questionnaire, the questionnaire task has no focus.
    expect(tasks.every((t) => t.focus === undefined)).toBe(true);
  });

  it('stamps dated fields only when `now` is provided', () => {
    const withDate = buildMenopauseCarePlan(baseOptions).carePlan;
    expect(withDate.created).toBe('2026-07-08');
    expect(withDate.period?.start).toBe('2026-07-08');

    const withoutDate = buildMenopauseCarePlan({ patient: 'Patient/alice' }).carePlan;
    expect(withoutDate.created).toBeUndefined();
    expect(withoutDate.period).toBeUndefined();
  });

  it('is deterministic with a sequential id generator', () => {
    const first = buildMenopauseCarePlanBundle({ ...baseOptions, idGenerator: sequentialIdGenerator() });
    const second = buildMenopauseCarePlanBundle({ ...baseOptions, idGenerator: sequentialIdGenerator() });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.entry?.[0]?.fullUrl).toBe('urn:uuid:00000000-0000-4000-8000-000000000004');
  });

  it('accepts a Reference object for the patient', () => {
    const { carePlan } = buildMenopauseCarePlan({
      patient: { reference: 'Patient/xyz', display: 'Test' },
    });
    expect(carePlan.subject?.reference).toBe('Patient/xyz');
  });
});
